/**
 * kite-holdings-sync Edge Function
 *
 * Phase 4 (gated): Syncs Zerodha holdings via Kite Connect API.
 * Verify Kite API pricing before un-gating.
 *
 * Deploy: supabase functions deploy kite-holdings-sync
 * Secrets: supabase secrets set KITE_API_KEY=... KITE_API_SECRET=...
 */

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // TODO Phase 4: call Kite Connect /portfolio/holdings, upsert into holdings table

    return new Response(
      JSON.stringify({ synced: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500 }
    );
  }
});
