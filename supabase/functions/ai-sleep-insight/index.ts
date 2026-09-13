/**
 * ai-sleep-insight Edge Function
 *
 * Groq-powered sleep insights from recent sleep_logs.
 * Caller (mobile/web) passes the last 14 nights as context; the function
 * never touches the DB itself (RLS stays client-side).
 *
 * Deploy: supabase functions deploy ai-sleep-insight
 * Secrets: GROQ_API_KEY
 */

import { createGroqClient } from "../_shared/groq.ts";

const SYSTEM_PROMPT = `You are a sleep coach AI inside Meridian, a personal life tracker app.

Your job: analyze the user's recent sleep logs and give ONE short, personal, actionable insight.

Rules:
- Base everything ONLY on the sleep data provided in context. Never invent data.
- If data is missing or sparse (< 3 nights), say so briefly instead of guessing.
- The user is a 23-year-old in India (IST), office 8 AM-6 PM, weight-gain protocol (Project 65) — sleep is critical for recovery.
- Format: 2-4 sentences max. Warm, direct, practical. No bullet-point essays.
- Focus on ONE thing: bedtime consistency, duration vs the 7.5h target, night wakes, or weekend drift.
- Suggest at most ONE concrete change for tonight.
- Never give medical advice. If the pattern looks concerning (e.g., consistently < 5h or many wakes), suggest consulting a doctor briefly.`;

const DAILY_LIMIT = 20;
const RATE_LIMIT_KV: { date: string; count: number } = { date: "", count: 0 };

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(): boolean {
  const today = getToday();
  if (RATE_LIMIT_KV.date !== today) {
    RATE_LIMIT_KV.date = today;
    RATE_LIMIT_KV.count = 1;
    return true;
  }
  if (RATE_LIMIT_KV.count >= DAILY_LIMIT) return false;
  RATE_LIMIT_KV.count++;
  return true;
}

interface NightRow {
  startTime: string;
  endTime: string;
  durationHours: number;
  quality: number | null;
  interruptions: number;
  source?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!checkRateLimit()) {
    return new Response(
      JSON.stringify({ insight: "Daily AI limit reached (20/day). Try again tomorrow." }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const nights = (body.nights as NightRow[]) || [];

    if (nights.length === 0) {
      return new Response(
        JSON.stringify({ insight: "No sleep data yet — log a night or two and I'll have something useful for you." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Build a compact context table (IST display-ish, from provided data)
    const table = nights
      .map(
        (n) =>
          `${new Date(n.startTime).toISOString().slice(0, 10)}: ${n.durationHours.toFixed(1)}h` +
          (n.quality ? `, quality ${n.quality}/5` : ", quality unrated") +
          (n.interruptions > 0 ? `, ${n.interruptions} wakes` : "")
      )
      .join("\n");

    const avg =
      nights.reduce((s, n) => s + (n.durationHours || 0), 0) / nights.length;
    const avgStr = avg.toFixed(1);

    const userMessage = `RECENT SLEEPS (newest last, avg ${avgStr}h over ${nights.length} nights, target 7.5h):\n${table}\n\nGive the user one short insight + at most one concrete suggestion for tonight.`;

    const groq = createGroqClient();
    const insight = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 300,
      temperature: 0.6,
    });

    return new Response(
      JSON.stringify({
        insight: insight.trim(),
        disclaimer: "Informational only — not medical advice.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-sleep-insight error:", err);
    return new Response(
      JSON.stringify({
        insight: "Sorry, I couldn't generate an insight right now. Try again later.",
        error: (err as Error).message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
