/**
 * ai-sms-parse Edge Function
 *
 * Phase 5: SMS parsing fallback — when the on-device regex rules engine can't parse a
 * bank/merchant SMS, this function sends the text to Claude for structured extraction.
 *
 * Deploy: supabase functions deploy ai-sms-parse
 * Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import { createClaudeClient } from "../_shared/claude.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { sms_text, sender } = await req.json();

    if (!sms_text) {
      return new Response(
        JSON.stringify({ error: "sms_text required" }),
        { status: 400 }
      );
    }

    // TODO Phase 5: call Claude with parsing schema, extract amount/merchant/last4

    return new Response(
      JSON.stringify({
        parsed: false,
        amount: null,
        merchant: null,
        last4: null,
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
