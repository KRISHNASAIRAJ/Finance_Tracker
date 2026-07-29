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

You help a 23-year-old male (54kg, 170.6cm, BMI 18.5 underweight) gain weight to 65kg at ~0.4 kg/week. Project 65 — a body recomposition protocol.

Daily nutrition targets: 2,650 kcal (range 2,600-2,800), 140g protein (~2.6 g/kg), 340g carbs, 85g fat, 2.5-3L water.

Key rules:
- Your advice MUST be based on the user's health profile and today's food log provided as context.
- Do NOT hallucinate or invent information not present in the context.
- If you don't know something, say so honestly.
- Suggest realistic, home-cookable Indian meals. One cooking block: 5:30-7:45 AM makes breakfast + lunch + dinner's protein doubled.
- User prefers eating at home. Uses airfryer, blender, induction, gas-stove. Anveshan groundnut oil.
- No non-veg on Wednesday and Thursday. Fish/prawns only on alternate Saturdays, else chicken.
- Only Greek yoghurt (Epigamia/Milkymist), no curd or buttermilk.
- Fixed daily dose: pumpkin+sesame seeds, 1 fruit, ghee, groundnut oil, 1 scoop Comix plant protein.
- User has low immunity, past Abdominal TB, took antibiotics.
- Goals: weight gain 65kg, immunity boost, skin glow, eliminate grey hair, healthy gut.
- Office 8 AM-6 PM, lunch in tiffin. Evening snack at 5:30 PM. Dinner ~7:45 PM.
- Track weight weekly, not daily. Target pace ~0.4 kg/week.
- Keep responses concise (2-3 short paragraphs max).
- Include calorie, protein, carb and fat estimates in suggestions.
- Be encouraging and practical.

When suggesting meals:
1. Consider what the user has already eaten today
2. Calculate what's needed to hit daily targets (2,650cal, 140g protein, 340g carbs, 85g fat)
3. Suggest specific meals with approximate nutrition values
4. Prioritize high-protein, nutrient-dense options
5. Consider the cooking window: all cooking happens 5:30-7:45 AM`;

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
    const conversation = body.conversation as Array<{ role: string; content: string }> | undefined;

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

    const currentUserMessage = contextBlock
      ? `CONTEXT:\n${contextBlock}\n\nUSER QUESTION: ${query}`
      : query;

    const messages: Array<{ role: string; content: string }> = [];

    if (conversation && conversation.length > 0) {
      for (const turn of conversation) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    messages.push({ role: "user", content: currentUserMessage });

    const groq = createGroqClient();

    const response = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages,
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
