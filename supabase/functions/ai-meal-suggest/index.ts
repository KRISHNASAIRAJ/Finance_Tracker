/**
 * ai-meal-suggest Edge Function
 *
 * Groq-powered meal suggestions for weight gain.
 * Passes health profile + today's meal log as context to prevent hallucination.
 *
 * Deploy: supabase functions deploy ai-meal-suggest
 * Secrets: GROQ_API_KEY
 */

import { createGroqClient } from "../_shared/groq.ts";

const SYSTEM_PROMPT = `You are a nutritionist AI assistant for Meridian, a personal life tracker app.

You help a 23-year-old male (54.5kg, 5'7"-5'8") gain weight to 65kg by end of 2026.

Key rules:
- Your advice MUST be based on the user's health profile and today's food log provided as context.
- Do NOT hallucinate or invent information not present in the context.
- If you don't know something, say so honestly.
- Suggest realistic, home-cookable Indian meals using the ingredients available (airfryer, blender, gas-stove).
- User prefers eating at home, no frozen items, very less oil (Anveshan groundnut oil).
- No non-veg on Wednesday and Thursday.
- User has low immunity, past Abdominal TB, took antibiotics.
- Goals: weight gain, immunity boost, skin glow, eliminate grey hair, healthy gut.
- Keep responses concise (2-3 short paragraphs max).
- Include calorie and protein estimates in suggestions.
- Be encouraging and practical.

When suggesting meals:
1. Consider what the user has already eaten today
2. Calculate what's needed to hit daily targets (2800cal, 100g protein)
3. Suggest specific meals with approximate nutrition values
4. Prioritize high-protein, nutrient-dense options`;

const DAILY_LIMIT = 50;
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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!checkRateLimit()) {
    return new Response(
      JSON.stringify({ suggestion: "Daily AI query limit reached (50/day). Try again tomorrow." }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const query = (body.query as string)?.trim();
    const healthProfile = (body.healthProfile as string)?.trim() || "";
    const todayContext = (body.todayContext as string)?.trim() || "";

    if (!query) {
      return new Response(
        JSON.stringify({ suggestion: "Please ask a question about your meals or nutrition." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const contextBlock = [
      healthProfile ? `HEALTH PROFILE:\n${healthProfile}` : "",
      todayContext ? `TODAY'S LOG:\n${todayContext}` : "",
    ].filter(Boolean).join("\n\n");

    const userMessage = contextBlock
      ? `CONTEXT:\n${contextBlock}\n\nUSER QUESTION: ${query}`
      : query;

    const groq = createGroqClient();

    const response = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 800,
      temperature: 0.7,
    });

    const disclaimer = "Based on your health profile and today's food log. Consult a doctor for medical advice.";

    return new Response(
      JSON.stringify({ suggestion: response, disclaimer }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-meal-suggest error:", err);
    return new Response(
      JSON.stringify({
        suggestion: "Sorry, I encountered an error. Please try again later.",
        error: (err as Error).message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
