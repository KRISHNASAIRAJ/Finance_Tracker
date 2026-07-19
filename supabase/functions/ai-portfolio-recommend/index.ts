/**
 * ai-portfolio-recommend Edge Function
 *
 * Phase 6: Portfolio recommendation — accepts holdings + goals,
 * calls Groq (Llama 3.3 70B) for rebalancing and allocation suggestions.
 *
 * Deploy: supabase functions deploy ai-portfolio-recommend
 * Secrets: supabase secrets set GROQ_API_KEY=gsk_...
 */

import { createGroqClient } from "../_shared/groq.ts";

const SYSTEM_PROMPT = `You are a portfolio advisor for Indian retail investors. The user will provide their current holdings (stocks, mutual funds, ETFs, gold, real estate) and their investment goals.

Your job: Provide concise, actionable rebalancing recommendations. Be conservative with advice. Always:
1. Note concentration risk if any single holding > 20% of portfolio
2. Suggest diversification if equity allocation is extreme for their goals
3. Mention tax implications for rebalancing (STCG/LTCG)
4. Return suggestions as a structured JSON array

Output format (ONLY valid JSON, no markdown):
{
  "summary": "<2-3 sentence overall assessment>",
  "recommendations": [
    {
      "action": "buy" | "sell" | "hold" | "rebalance",
      "asset": "<security name or category>",
      "reason": "<one-line justification>",
      "priority": "high" | "medium" | "low"
    }
  ]
}

At the end, include this disclaimer: "For informational purposes only. This is not investment advice."`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const { holdings, goals } = await req.json();

    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "Add some holdings first to get personalized recommendations.",
          recommendations: [],
          disclaimer: "For informational purposes only. This is not investment advice.",
        }),
        { status: 400, headers }
      );
    }

    // Build a structured context for Groq
    const holdingsSummary = holdings.map((h: any) => {
      const value = h.quantity * h.currentPrice;
      const cost = h.quantity * h.avgPrice;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0.0";
      return `- ${h.symbol || h.name} (${h.type}): ${h.quantity} units, value ₹${Math.round(value / 100).toLocaleString('en-IN')}, P&L ${pnl >= 0 ? '+' : ''}${pnlPct}%, allocation: ${h.allocation || 'Uncategorized'}`;
    }).join("\n");

    const goalsSummary = goals && goals.length > 0
      ? goals.map((g: any) => {
          const progress = g.current > 0 && g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
          return `- ${g.name}: ₹${Math.round(g.current / 100).toLocaleString('en-IN')} / ₹${Math.round(g.target / 100).toLocaleString('en-IN')} (${progress}%), due ${g.dueDate ? new Date(g.dueDate).getFullYear() : 'N/A'}`;
        }).join("\n")
      : "No goals set.";

    const userPrompt = `Current Holdings:\n${holdingsSummary}\n\nInvestment Goals:\n${goalsSummary}\n\nProvide rebalancing recommendations.`;

    const groq = createGroqClient();

    const response = await groq.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 1024,
      temperature: 0.5,
    });

    // Parse JSON from Groq response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          summary: response.trim().slice(0, 300),
          recommendations: [],
          disclaimer: groq.DISCLAIMER_PORTFOLIO,
        }),
        { status: 200, headers }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        summary: parsed.summary || "Analysis complete.",
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        disclaimer: groq.DISCLAIMER_PORTFOLIO,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        summary: "Sorry, I couldn't analyze your portfolio right now. Please try again.",
        recommendations: [],
        error: (err as Error).message,
        disclaimer: "For informational purposes only. This is not investment advice.",
      }),
      { status: 500, headers }
    );
  }
});
