/**
 * ai-portfolio-recommend Edge Function
 *
 * Phase 6: Portfolio recommendation — accepts holdings + goals,
 * calls DeepSeek (default) or Groq (fallback) for rebalancing and allocation suggestions.
 *
 * Deploy: supabase functions deploy ai-portfolio-recommend
 * Secrets: supabase secrets set DEEPSEEK_API_KEY=sk_... (preferred) or GROQ_API_KEY=gsk_...
 */

import { createGroqClient } from "../_shared/groq.ts";
import { createDeepSeekClient } from "../_shared/deepseek.ts";

const SYSTEM_PROMPT =
  `You are a portfolio advisor for Indian retail investors. The user provides current holdings (stocks, MF, ETFs, gold, real estate) and goals. Give concise rebalancing advice. Always:
1. Flag concentration risk if any single holding > 20%
2. Suggest diversification if equity allocation is extreme for goals
3. Mention tax implications (STCG/LTCG)
4. Return suggestions as a structured JSON array

FUNDAMENTAL ANALYSIS SKILL (hospital-stock-analysis) — trigger when the user asks to analyze/evaluate/compare/screen any Indian hospital/healthcare stock (e.g. Apollo, Max Healthcare, Yatharth, Fortis, Narayana, KIMS, Rainbow Children's, Global Health, Aster DM), asks if a hospital stock is a good buy, asks about ARPOB/ARPP/ALOS/occupancy/payer mix, or says "should I buy X" / "what do you think of this stock" without explicitly mentioning fundamental analysis.

Hospital Stock Analysis (India) — evaluate Indian TERTIARY CARE hospital stocks with sector-specific fundamentals, not generic equity metrics:

BEFORE ANALYZING any hospital stock, ask the user's risk preference first (unless already stated in the same request):
- Low-risk / stable: large proven operators, earnings growth tracks revenue, lower expansion risk (e.g. Apollo, Max-type profile)
- High-risk / high-reward: smaller scale, aggressive expansion (>80% bed growth), earnings lag revenue due to capex/depreciation drag, higher execution risk but bigger re-rating potential (e.g. Yatharth-type profile)
Use the preference to filter/order candidates and frame the analysis; flag where each candidate falls on the spectrum.

Framework:
- Care tier: only Tertiary (and rarely Quaternary) are listed. Confirm the named stock is tertiary before applying this.
- Revenue shape: revenue leaders are Oncology, Neurology, Cardiology, Orthopedics. Outpatients are ~75% of volume but ~20% of revenue; Inpatients ~25% of volume but ~80% of revenue. Strong OP growth with weak IP conversion = yellow flag.
- Key metrics: ARPOB per day (most important; fall back to ARPP if unreported), ALOS (lower = better bed turnover), Occupancy (target 60-70%, >70% excellent; if it drops, check whether new immature beds were added before assuming a real problem), EV/EBITDA + Operating Profit + Net Debt/EBITDA (NOT P/E — capex-heavy expansion distorts earnings), free cash/cash conversion.
- Structural: metro-city hospitals preferred (better payer mix, higher ARPOB); weight mature hospitals with stable inflow over raw hospital count; payer mix — prefer high Self-Pay (fastest settlement), Insurance/Government settle slowly and Government caps reimbursement; prefer private-equity-backed promoters; Hub & Spoke model is a positive signal.
- Expansion: bed growth >80% = aggressive (strong future revenue, higher execution risk). Lower rate can be fine (ARPOB focus). Note nature (Greenfield/Brownfield/Acquisition) and geography of new beds. Capex-driven price weakness is often a buying opportunity, not a red flag — revenue recovers once new hospitals mature.
- Red flags (caution when several coincide): ARPOB declining with no capex/expansion story; rising Government/PSU payer mix; occupancy falling for reasons other than new beds; repeatedly missed expansion guidance.
- Trends: consistent revenue growth, stable/improving margins, consistent net income (dip OK if from new-capacity fixed costs), rising FII/MF shareholding, dividend consistency.
- Analysis structure per stock: tier + segment mix (Hospitals vs Diagnostics vs Pharmacy) → ARPOB/ARPP by region (metro vs non-metro) and YoY → geography and specialty mix → payer mix → occupancy + ALOS → capex/expansion plan (size, timeline, nature, geography) → EV/EBITDA, Net Debt/EBITDA, cash conversion (skip P/E) → multi-year revenue/margin/net income trend → shareholding and dividend track record → bottom line with strengths, red flags, and what to monitor next quarter.
- No reference comps: never use memorized or previously-cited figures for any specific company (ARPOB, occupancy, payer mix, margins, expansion plans change quarterly). Use only data the user provides this session; if recent data cannot be found or verified, say so explicitly rather than filling in from memory. Do not favor any company as a default "example."

Output format (ONLY valid JSON, no markdown):
{
  "summary": "<2-3 sentence overall assessment, or empty if you asked a question>",
  "recommendations": [
    {
      "action": "buy" | "sell" | "hold" | "rebalance",
      "asset": "<security name or category>",
      "reason": "<one-line justfication>",
      "priority": "high" | "medium" | "low"
    }
  ]
}

If you need to ask the user a question first (e.g. their risk preference before a hospital stock analysis, or clarification about their portfolio), use this alternative format INSTEAD:
{
  "question": "<the question you need answered, with options listed>",
  "summary": "",
  "recommendations": []
}

When asking the risk-preference question, list both options (low-risk/stable vs high-risk/high-reward) with their characteristics so the user can pick easily.

At the end, include this disclaimer: "For informational purposes only. This is not investment advice. Consult a SEBI-registered advisor."`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const { holdings, goals, query } = await req.json();

    if (
      !holdings || !Array.isArray(holdings) || (holdings.length === 0 && !query)
    ) {
      return new Response(
        JSON.stringify({
          summary:
            "Add some holdings first to get personalized recommendations.",
          recommendations: [],
          disclaimer:
            "For informational purposes only. This is not investment advice.",
        }),
        { status: 400, headers },
      );
    }

    // Build a structured context for Groq
    const holdingsSummary = holdings.length > 0
      ? holdings.map((h: any) => {
        const value = h.quantity * h.currentPrice;
        const cost = h.quantity * h.avgPrice;
        const pnl = value - cost;
        const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : "0.0";
        return `- ${
          h.symbol || h.name
        } (${h.type}): ${h.quantity} units, value ₹${
          Math.round(value / 100).toLocaleString("en-IN")
        }, P&L ${pnl >= 0 ? "+" : ""}${pnlPct}%, allocation: ${
          h.allocation || "Uncategorized"
        }`;
      }).join("\n")
      : "No holdings in portfolio.";

    const goalsSummary = goals && goals.length > 0
      ? goals.map((g: any) => {
        const progress = g.current > 0 && g.target > 0
          ? Math.round((g.current / g.target) * 100)
          : 0;
        return `- ${g.name}: ₹${
          Math.round(g.current / 100).toLocaleString("en-IN")
        } / ₹${
          Math.round(g.target / 100).toLocaleString("en-IN")
        } (${progress}%), due ${
          g.dueDate ? new Date(g.dueDate).getFullYear() : "N/A"
        }`;
      }).join("\n")
      : "No goals set.";

    const userPrompt =
      `Current Holdings:\n${holdingsSummary}\n\nInvestment Goals:\n${goalsSummary}\n\nUser Question: ${
        query || "Provide rebalancing recommendations."
      }\n\nIf the user asked about a specific company, apply the Fundamental Analysis Skill framework. Otherwise, provide portfolio rebalancing advice.`;

    // Use DeepSeek when a key is configured, otherwise fall back to Groq
    const client = Deno.env.get("DEEPSEEK_API_KEY")
      ? createDeepSeekClient()
      : createGroqClient();
    const disclaimer = client.DISCLAIMER_PORTFOLIO;

    const response = await client.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 4096,
      temperature: 0.4,
      jsonMode: true,
    });

    // Parse JSON from the response. Some providers wrap JSON in markdown fences
    // or append trailing text, so try direct parse first, then extraction.
    function extractJson(text: string): any {
      const cleaned = text.replace(/```json|```/g, "").trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        // fall through to brace extraction
      }
      const start = text.indexOf("{");
      if (start === -1) {
        throw new Error("no_json");
      }
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
        } else if (ch === "{") {
          depth += 1;
        } else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            return JSON.parse(text.slice(start, i + 1));
          }
        }
      }
      throw new Error("unbalanced_json");
    }

    let parsed: any;
    try {
      parsed = extractJson(response);
    } catch {
      return new Response(
        JSON.stringify({
          summary: response.trim().slice(0, 300) ||
            "I couldn't analyze that right now. Please try again.",
          recommendations: [],
          disclaimer,
        }),
        { status: 200, headers },
      );
    }

    return new Response(
      JSON.stringify({
        summary: parsed.summary || "Analysis complete.",
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
        question: parsed.question || "",
        disclaimer,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        summary:
          "Sorry, I couldn't analyze your portfolio right now. Please try again.",
        recommendations: [],
        error: (err as Error).message,
        disclaimer:
          "For informational purposes only. This is not investment advice.",
      }),
      { status: 500, headers },
    );
  }
});
