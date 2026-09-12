/**
 * ai-daily-report Edge Function — Personal AI use case (SAFETY.md §10 documented)
 *
 * Use case: Daily Report (evening summary + morning briefing)
 *  - Inputs to Groq (minimal data): task names/status for the day, meal item
 *    names + user's meal notes for the day. NO financial data, NO account
 *    identifiers, NO card numbers, NO amounts.
 *  - Output: JSON report { headline, summary, sections[] } with a motivating
 *    quote and a productivity tip. Motivational/wellness content only — the
 *    system prompt forbids medical or financial advice.
 *  - Rate limit: cron-driven, max 1 call/user/day/mode (2 total per day).
 *    Manual trigger allowed but idempotent per (user, date, mode).
 *  - Anti-spam: a report is generated once per (user, report_date, mode);
 *    re-invocations skip users that already have their report.
 *
 * Triggered by pg_cron:
 *  - evening: 9:30 PM IST  = '30 16 * * *' (16:00 UTC)
 *  - morning: 8:30 AM IST  = '0 3 * * *'   (03:00 UTC)
 * or manual POST { mode: 'evening' | 'morning' }.
 *
 * Deploy: supabase functions deploy ai-daily-report
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGroqClient } from "../_shared/groq.ts";

interface TaskRow {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
}

interface MealLogRow {
  date: string;
  meal_type: string;
  items: string | null;
  notes: string | null;
}

interface ReportSection {
  title: string;
  body: string;
}

interface ReportContent {
  headline: string;
  summary: string;
  sections: ReportSection[];
  disclaimer: string;
}

const DISCLAIMER =
  "General motivation only — not medical, financial, or professional advice.";

const EVENING_PROMPT = `You write a warm, personal END-OF-DAY report for a life-tracker app user. You will receive: tasks completed today, tasks still open, and meals logged today (with the user's own notes).

Return ONLY valid JSON:
{
  "headline": "one short punchy line about the day (max 60 chars)",
  "summary": "2-3 sentence warm recap of the day based ONLY on the data",
  "sections": [
    { "title": "DONE TODAY", "body": "short celebratory line listing what got done, or 'Nothing checked off — tomorrow is a fresh start.' Use bullet lines starting with '- ' inside body if listing." },
    { "title": "STILL OPEN", "body": "the open tasks as '- name' bullet lines, or 'All clear — inbox zero.' Max 5." },
    { "title": "FOOD & ENERGY", "body": "1-2 sentence observation about today's meals and any pattern in the user's notes. Non-judgmental." },
    { "title": "QUOTE", "body": "ONE motivating quote (max 120 chars) with '— Author' at the end. Vary authors daily; never repeat the same quote twice in a row." },
    { "title": "TOMORROW'S EDGE", "body": "ONE concrete productivity suggestion tied to the open tasks or meal notes (max 200 chars). Actionable, specific, no fluff." }
  ],
  "disclaimer": "${DISCLAIMER}"
}
Rules: encouraging, never preachy. Never give medical/dietary prescriptions or financial advice. If the data is empty, write a gentle note that nothing was logged today.`;

const MORNING_PROMPT = `You write a crisp, energising MORNING briefing for a life-tracker app user. You will receive: today's tasks, upcoming tasks, and meals logged yesterday.

Return ONLY valid JSON:
{
  "headline": "one short energising line for the day (max 60 chars)",
  "summary": "2-3 sentence preview: what the day looks like from the task data",
  "sections": [
    { "title": "TODAY'S FOCUS", "body": "top 1-3 tasks as '- name' bullets, or 'No tasks scheduled — pick one thing that moves you forward.'" },
    { "title": "COMING UP", "body": "next tasks (after today) as '- name — due Mon' bullets, or 'Nothing scheduled ahead.'" },
    { "title": "YESTERDAY'S FOOD", "body": "1-2 sentence neutral note on yesterday's logged meals if any, else 'No meals logged yesterday — log them today for better insights.'" },
    { "title": "QUOTE", "body": "ONE motivating quote (max 120 chars) with '— Author' at the end. Vary authors daily." },
    { "title": "ONE THING", "body": "THE single highest-leverage action for today drawn from the tasks (max 200 chars)." }
  ],
  "disclaimer": "${DISCLAIMER}"
}
Rules: brief, motivating, specific. Never give medical/dietary prescriptions or financial advice.`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // --- LEGACY PATH: MealLoggerScreen inline nutrition report (body.todayIntake) ---
    if (body && typeof body.todayIntake === "string") {
      return await nutritionReport(body.todayIntake);
    }

    // --- NEW PATH: cron / manual Daily Report (evening summary + morning briefing) ---
    return await dailyLifeReport(body);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/** Legacy nutrition EOD report — Project 65 protocol (called from MealLoggerScreen). */
async function nutritionReport(todayIntake: string): Promise<Response> {
  const SYSTEM_PROMPT = `You are a nutritionist AI for Meridian's "Project 65" body recomposition protocol.
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

  const intake = todayIntake.trim() || "No meals logged today.";
  try {
    const groq = createGroqClient();
    const response = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Today's intake:\n${intake}` }],
      maxTokens: 800,
      temperature: 0.5,
    });
    return new Response(
      JSON.stringify({ report: response }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-daily-report nutrition error:", err);
    return new Response(
      JSON.stringify({ report: "Sorry, could not generate the daily report. Please try again.", error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** Cron-driven Daily Report flow — evening summary / morning briefing. */
async function dailyLifeReport(body: Record<string, unknown>): Promise<Response> {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const groq = createGroqClient();

    const mode: "evening" | "morning" = body?.mode === "morning" ? "morning" : "evening";
    const manualUserId: string | undefined = body?.user_id;

    // report_date in IST so manual "Generate Now" between 00:00-05:29 IST
    // files under the user's calendar day (matches the app's Today chip).
    const reportDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split("T")[0];

    // Determine target users: manual single user, or everyone with a device token.
    let userIds: string[] = [];
    if (manualUserId) {
      userIds = [manualUserId];
    } else {
      const { data: tokenRows } = await supabase
        .from("device_tokens")
        .select("user_id");
      userIds = [...new Set((tokenRows ?? []).map((r: any) => r.user_id as string))];
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, date: reportDate, mode, users: 0, message: "No users with device tokens" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown>[] = [];

    for (const userId of userIds) {
      // Anti-spam / idempotency: skip if this report already exists AND is
      // non-empty. A wedged empty row (e.g. failed insert of JSONB default)
      // is regenerated instead of permanently blocking the date.
      const { data: existing, error: existingErr } = await supabase
        .from("daily_reports")
        .select("id, content")
        .eq("user_id", userId)
        .eq("report_date", reportDate)
        .eq("mode", mode)
        .maybeSingle();
      if (existingErr) {
        // Table missing or unreadable — surface honestly instead of silent skip.
        console.error("daily_reports select failed:", existingErr.message);
        results.push({ user_id: userId, error: "db_failed", detail: existingErr.message });
        continue;
      }
      const hasContent = !!(existing as any)?.content?.headline;
      if (existing && hasContent) {
        results.push({ user_id: userId, skipped: "already generated" });
        continue;
      }

      // --- Gather minimal day data (SAFETY.md: no amounts, no identifiers) ---
      const { data: taskRows } = await supabase
        .from("tasks")
        .select("id, name, description, due_date, is_completed, completed_at")
        .eq("user_id", userId);

      const { data: mealRows } = await supabase
        .from("meal_logs")
        .select("date, meal_type, items, notes")
        .eq("user_id", userId);

      const tasks = (taskRows ?? []) as TaskRow[];
      const meals = (mealRows ?? []) as MealLogRow[];

      const istDay = (iso: string | null | undefined): string | null => {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().split("T")[0];
      };

      let dataBlock: string;
      if (mode === "evening") {
        const doneToday = tasks
          .filter((t) => t.is_completed && istDay(t.completed_at) === reportDate)
          .map((t) => t.name);
        const open = tasks
          .filter((t) => !t.is_completed)
          .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
          .slice(0, 5)
          .map((t) => `${t.name}${t.due_date ? ` (due ${t.due_date})` : ""}`);
        const todayMeals = meals
          .filter((m) => (m.date ?? "").slice(0, 10) === reportDate)
          .map((m) => {
            let items: string[] = [];
            try { items = JSON.parse(m.items ?? "[]"); } catch { items = []; }
            return `- ${m.meal_type}: ${items.join(", ")}${m.notes ? ` | user note: ${m.notes}` : ""}`;
          });

        dataBlock = [
          `DATE: ${reportDate} (end-of-day report)`,
          `TASKS COMPLETED TODAY: ${doneToday.length ? doneToday.join("; ") : "(none logged)"}`,
          `OPEN TASKS: ${open.length ? open.join("; ") : "(none)"}`,
          `MEALS LOGGED TODAY:\n${todayMeals.length ? todayMeals.join("\n") : "(none logged)"}`,
        ].join("\n\n");
      } else {
        const todayKey = reportDate;
        const todayTasks = tasks
          .filter((t) => !t.is_completed && (t.due_date ?? "").slice(0, 10) <= todayKey)
          .slice(0, 5)
          .map((t) => `${t.name}${t.due_date ? ` (due ${t.due_date})` : ""}`);
        const upcoming = tasks
          .filter((t) => !t.is_completed && (t.due_date ?? "").slice(0, 10) > todayKey)
          .slice(0, 5)
          .map((t) => `${t.name} (due ${t.due_date})`);
        const yesterdayKey = new Date(Date.parse(reportDate) - 86400000).toISOString().split("T")[0];
        const yMeals = meals
          .filter((m) => (m.date ?? "").slice(0, 10) === yesterdayKey)
          .map((m) => {
            let items: string[] = [];
            try { items = JSON.parse(m.items ?? "[]"); } catch { items = []; }
            return `- ${m.meal_type}: ${items.join(", ")}${m.notes ? ` | user note: ${m.notes}` : ""}`;
          });

        dataBlock = [
          `DATE: ${reportDate} (morning briefing)`,
          `TODAY'S TASKS: ${todayTasks.length ? todayTasks.join("; ") : "(none scheduled)"}`,
          `UPCOMING: ${upcoming.length ? upcoming.join("; ") : "(none)"}`,
          `YESTERDAY'S MEALS:\n${yMeals.length ? yMeals.join("\n") : "(none logged)"}`,
        ].join("\n\n");
      }

      // --- Groq call ---
      let report: ReportContent;
      try {
        const raw = await groq.complete({
          systemPrompt: mode === "evening" ? EVENING_PROMPT : MORNING_PROMPT,
          messages: [{ role: "user", content: dataBlock }],
          maxTokens: 900,
          temperature: 0.8,
          jsonMode: true,
        });
        const cleaned = raw.replace(/```json|```/g, "").trim();
        report = JSON.parse(cleaned) as ReportContent;
      } catch (aiErr) {
        console.error(`ai-daily-report Groq failed for ${userId}:`, (aiErr as Error).message);
        results.push({ user_id: userId, error: "ai_failed" });
        continue;
      }

      if (!report?.headline || !Array.isArray(report.sections)) {
        results.push({ user_id: userId, error: "malformed_ai_response" });
        continue;
      }

      // SAFETY.md §4.3: enforce disclaimer
      if (report.disclaimer !== DISCLAIMER) report.disclaimer = DISCLAIMER;

      const { error: upsertErr } = await supabase
        .from("daily_reports")
        .upsert(
          {
            user_id: userId,
            report_date: reportDate,
            mode,
            content: report,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,report_date,mode" }
        );
      if (upsertErr) {
        console.error(`daily_reports upsert failed for ${userId}:`, upsertErr.message);
        results.push({ user_id: userId, error: "db_failed" });
        continue;
      }

      // --- Expo push ---
      try {
        const { data: tokens } = await supabase
          .from("device_tokens")
          .select("token")
          .eq("user_id", userId);

        const title = mode === "evening" ? report.headline : `Good morning — ${report.headline}`;
        const pushBody = report.summary.length > 180 ? `${report.summary.slice(0, 177)}...` : report.summary;

        for (const t of tokens ?? []) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: (t as any).token,
              title,
              body: pushBody,
              data: { screen: "DailyReport", reportDate, mode },
              priority: "high",
            }),
          });
        }
      } catch (pushErr) {
        console.warn("Push skipped:", (pushErr as Error).message);
      }

      results.push({ user_id: userId, generated: true, mode });
    }

    // Manual single-user invocations surface per-user failure honestly so the
    // app can tell the user WHY generation failed (cron path ignores this).
    const isManual = !!manualUserId;
    const failed = results.filter((r) => (r as any).error);
    const ok = failed.length === 0 || (isManual ? false : true) || results.some((r) => (r as any).generated);
    return new Response(
      JSON.stringify({
        ok: isManual ? ok : true,
        date: reportDate,
        mode,
        users: userIds.length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
