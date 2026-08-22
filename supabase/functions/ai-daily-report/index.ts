/**
 * ai-daily-report Edge Function
 *
 * EOD daily nutrition report comparing today's intake against
 * the Project 65 body recomposition protocol targets.
 * Triggered after dinner is logged.
 *
 * Deploy: supabase functions deploy ai-daily-report
 * Secrets: GROQ_API_KEY
 */

import { createGroqClient } from "../_shared/groq.ts";

const SYSTEM_PROMPT =
  `You are a nutritionist AI for Meridian's "Project 65" body recomposition protocol.
Generate a concise end-of-day report comparing the user's logged intake against their targets.

AGE: 23, Male, 54kg, 170.6cm, BMI 18.5 (underweight)
TARGET: 65kg at ~0.4 kg/week. Rebuilding weight, strength, immunity, and skin after TB/antibiotics.

DAILY TARGETS:
- Calories: 2,650 kcal (range 2,600-2,800)
- Protein: 140g (~2.6 g/kg)
- Carbs: 340g
- Fat: 85g
- Water: 2.5-3L

FULL DIET PROTOCOL (Project 65):

MEAL STRUCTURE:
- One cooking block: 5:30-7:45 AM (breakfast + lunch + dinner's protein doubled)
- Lunch in tiffin to office (8 AM-6 PM, 40 min commute)
- Dinner: reheat morning protein + fresh dosa/chapati (~7:45 PM)
- No non-veg Wed & Thu. Fish/prawns alternate Saturdays only.
- Only Greek yoghurt (Epigamia/Milkymist), no curd/buttermilk.

FIXED DAILY DOSE: 1 tbsp pumpkin seeds + 1 tbsp sesame seeds, roasted | 1 fruit (banana/avocado/pineapple) | 1-2 tsp ghee on dal/rice + Anveshan groundnut oil | 1 scoop Comix plant protein (~24g) | 2.5-3L water

WAKE-UP: Mon-Thu 5:30 AM, Fri-Sun 7:00 AM. Walk 15-20 min morning + evening.

7-DAY ROTATION:
Mon: Overnight oats + rice/rasam/chicken/cabbage (lunch+dinner: reheat chicken + 2 ragi dosa)
Tue: Dosa+egg + rice/sambar/chicken/carrot (dinner: chapati)
Wed (VEG): Overnight oats + rice/dal/cabbage (dinner: ragi dosa) — mandatory dal day
Thu (VEG): Sourdough+avocado + rice/pappu/paneer/beetroot (dinner: aloo-paneer paratha)
Fri: Dosa+egg + rice/rasam/chicken/bhindi (dinner: chapati)
Sat: Overnight oats + rice/kurma/fish-or-chicken/cabbage (dinner: ragi dosa) — fish alternate weekends
Sun: Sourdough+PB+banana + rice/sambar/chicken curry (dinner: chapati) — prep day

SNACKS: Morning ~10:45 AM and evening ~5:30 PM (chana, nuts, makhana, fruit chaat, protein shake, yoghurt bowl)

RULES:
1. Compare today's actual intake against the 2,650kcal/140g protein/340g carbs/85g fat targets.
2. Calculate what percentage of each target was hit.
3. Point out any gaps (e.g., "protein was only 85g, 45g short — missed the evening seed dose and plant protein shake").
4. Note what went well (e.g., "carbs and calories were solid — rice at lunch carried that").
5. Give ONE actionable suggestion for tomorrow based on the protocol (e.g., "Since it's Wednesday tomorrow — vegetarian, mandatory dal day — make sure to double the dal batch and pack the yoghurt bowl for the evening snack").
6. Be encouraging but honest. Keep it to 4-5 short paragraphs.
7. Output as plain text, no JSON needed. DO NOT use markdown headers.`;

const DAILY_LIMIT = 30;
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
      JSON.stringify({
        report: "Daily report limit reached (30/day). Try again tomorrow.",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const todayIntake = (body.todayIntake as string)?.trim() ||
      "No meals logged today.";

    const groq = createGroqClient();
    const response = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Today's intake:\n${todayIntake}` }],
      maxTokens: 800,
      temperature: 0.5,
    });

    return new Response(
      JSON.stringify({ report: response }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ai-daily-report error:", err);
    return new Response(
      JSON.stringify({
        report: "Sorry, could not generate the daily report. Please try again.",
        error: (err as Error).message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
