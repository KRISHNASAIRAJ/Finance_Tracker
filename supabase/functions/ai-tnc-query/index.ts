/**
 * ai-tnc-query Edge Function
 *
 * Phase 6: Card T&C RAG chat — user asks a question about their uploaded card T&C document,
 * the function embeds the question, finds relevant chunks via pgvector cosine search,
 * and asks Claude to answer grounded in those chunks.
 *
 * Deploy: supabase functions deploy ai-tnc-query
 * Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import { createClaudeClient } from "../_shared/claude.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { query, document_id, user_id } = await req.json();

    if (!query || !document_id) {
      return new Response(
        JSON.stringify({ error: "query and document_id required" }),
        { status: 400 }
      );
    }

    // TODO Phase 6: embed query → pgvector cosine search → build prompt → Claude

    const claude = createClaudeClient();

    return new Response(
      JSON.stringify({
        answer: "Phase 6 — not implemented yet",
        disclaimer: claude.DISCLAIMER_TNC,
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
