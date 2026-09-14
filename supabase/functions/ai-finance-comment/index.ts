/**
 * ai-finance-comment Edge Function
 *
 * Groq-powered daily finance commentary for the Home screen, based on the
 * user's month spends (caller-supplied context — function never touches the
 * DB, RLS stays client-side).
 *
 * Deploy: supabase functions deploy ai-finance-comment
 * Secrets: GROQ_API_KEY
 */

import { createGroqClient } from "../_shared/groq.ts";

const SYSTEM_PROMPT = `You are a friendly personal-finance commentator inside Meridian, a personal life tracker app.

Your job: comment on the user's spending for the current month — like a smart friend who glances at their statement and says something useful.

Rules:
- Base everything ONLY on the spend data provided in context. Never invent numbers.
- If there is little/no data, say something brief and encouraging instead of guessing.
- The user is a 23-year-old salaried person in India saving toward aggressive net-worth goals (personal finance discipline matters a lot to them).
- Format: 2-4 sentences max. Conversational, warm, direct. No bullet lists, no headers.
- Structure: (1) one notable observation — top category, biggest single spend, unusual spike, or a win like low discretionary spend; (2) at most ONE practical suggestion (budget nudge, category watch, a good habit to keep).
- Use ₹ amounts exactly as given. Percentages only when the math is trivially safe.
- Never give investment advice. Keep it about spending/saving habits.`;

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

interface CategoryRow {
  category: string;
  amountRupees: number;
  count: number;
}

interface Context {
  monthLabel: string;
  totalSpendRupees: number;
  budgetRupees?: number | null;
  topDay?: { date: string; amountRupees: number } | null;
  biggestTx?: { category: string; amountRupees: number; note?: string } | null;
  lastMonthTotalRupees?: number | null;
  categories: CategoryRow[];
  monthIncomeRupees?: number | null;
  bankBalanceRupees?: number | null;
  cardOutstandingRupees?: number | null;
  lentOutRupees?: number | null;
  borrowedRupees?: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!checkRateLimit()) {
    return new Response(
      JSON.stringify({ comment: "Daily AI limit reached (20/day). Try again tomorrow." }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const ctx = (body.context as Context) || null;

    if (!ctx || !ctx.categories || ctx.categories.length === 0) {
      return new Response(
        JSON.stringify({
          comment:
            "No spends logged yet this month — clean slate! Log a few transactions and I'll tell you what your money is up to.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const lines: string[] = [];
    lines.push(`MONTH: ${ctx.monthLabel}`);
    lines.push(`TOTAL SPENT so far: ₹${Math.round(ctx.totalSpendRupees).toLocaleString("en-IN")}`);
    if (ctx.budgetRupees && ctx.budgetRupees > 0) {
      const usedPct = Math.round((ctx.totalSpendRupees / ctx.budgetRupees) * 100);
      lines.push(`MONTH BUDGET: ₹${Math.round(ctx.budgetRupees).toLocaleString("en-IN")} (${usedPct}% used)`);
    }
    if (typeof ctx.lastMonthTotalRupees === "number" && ctx.lastMonthTotalRupees > 0) {
      const delta = ctx.totalSpendRupees - ctx.lastMonthTotalRupees;
      const pct = Math.round((delta / ctx.lastMonthTotalRupees) * 100);
      lines.push(
        `LAST MONTH total: ₹${Math.round(ctx.lastMonthTotalRupees).toLocaleString("en-IN")} (this month is ${pct >= 0 ? "+" : ""}${pct}% vs last)`
      );
    }
    lines.push(`TOP CATEGORIES:`);
    for (const c of ctx.categories.slice(0, 8)) {
      lines.push(`- ${c.category}: ₹${Math.round(c.amountRupees).toLocaleString("en-IN")} across ${c.count} txns`);
    }
    if (ctx.topDay && ctx.topDay.amountRupees > 0) {
      lines.push(`BIGGEST SPEND DAY: ${ctx.topDay.date} — ₹${Math.round(ctx.topDay.amountRupees).toLocaleString("en-IN")}`);
    }
    if (ctx.biggestTx && ctx.biggestTx.amountRupees > 0) {
      lines.push(`BIGGEST SINGLE TXN: ${ctx.biggestTx.category} ₹${Math.round(ctx.biggestTx.amountRupees).toLocaleString("en-IN")}${ctx.biggestTx.note ? ` (${ctx.biggestTx.note})` : ""}`);
    }
    if (typeof ctx.monthIncomeRupees === "number" && ctx.monthIncomeRupees > 0) {
      lines.push(`INCOME this month: ₹${Math.round(ctx.monthIncomeRupees).toLocaleString("en-IN")}`);
      lines.push(`SAVINGS this month (income − spend): ₹${Math.round(ctx.monthIncomeRupees - ctx.totalSpendRupees).toLocaleString("en-IN")}`);
    }
    if (typeof ctx.bankBalanceRupees === "number" && ctx.bankBalanceRupees > 0) {
      lines.push(`TOTAL BANK BALANCE: ₹${Math.round(ctx.bankBalanceRupees).toLocaleString("en-IN")}`);
    }
    if (typeof ctx.cardOutstandingRupees === "number" && ctx.cardOutstandingRupees > 0) {
      lines.push(`CREDIT CARD OUTSTANDING: ₹${Math.round(ctx.cardOutstandingRupees).toLocaleString("en-IN")}`);
    }
    if (typeof ctx.lentOutRupees === "number" && ctx.lentOutRupees > 0) {
      lines.push(`LENT OUT (pending): ₹${Math.round(ctx.lentOutRupees).toLocaleString("en-IN")}`);
    }
    if (typeof ctx.borrowedRupees === "number" && ctx.borrowedRupees > 0) {
      lines.push(`BORROWED (pending): ₹${Math.round(ctx.borrowedRupees).toLocaleString("en-IN")}`);
    }

    const userMessage = `${lines.join("\n")}\n\nGive the user one short observation about their overall money this month (spending, savings, balances, or lending) + at most one practical suggestion. Keep it human.`;

    const groq = createGroqClient();
    const comment = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 300,
      temperature: 0.7,
    });

    return new Response(
      JSON.stringify({ comment: comment.trim() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-finance-comment error:", err);
    return new Response(
      JSON.stringify({
        comment: "Couldn't generate a finance note right now. Try again later.",
        error: (err as Error).message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
