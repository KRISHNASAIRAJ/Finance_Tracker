/**
 * ai-portfolio-recommend Edge Function
 *
 * Phase 6: Portfolio recommendation — fetches holdings + goals from DB,
 * builds a structured prompt (no raw PII), calls Claude for high-level suggestions.
 *
 * Deploy: supabase functions deploy ai-portfolio-recommend
 * Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import { createClaudeClient } from "../_shared/claude.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // TODO Phase 6: fetch holdings + goals from DB, build prompt, call Claude

    const claude = createClaudeClient();

    return new Response(
      JSON.stringify({
        recommendations: [],
        disclaimer: claude.DISCLAIMER_PORTFOLIO,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500 }
    );
  }
});
