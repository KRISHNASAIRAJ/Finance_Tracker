/**
 * portfolio-snapshot Edge Function
 *
 * Phase 4: Daily portfolio snapshot triggered by pg_cron at 15:30 UTC (8:30 PM IST).
 * Aggregates all holdings, computes total value + day change,
 * inserts a row into portfolio_snapshots.
 *
 * Deploy: supabase functions deploy portfolio-snapshot
 * pg_cron schedule:
 *   SELECT cron.schedule('portfolio-snapshot', '30 15 * * *',
 *     $$ SELECT net.http_post(url:='https://[ref].supabase.co/functions/v1/portfolio-snapshot',
 *                              headers:='{"Authorization":"Bearer [service_role]"}'::jsonb) $$);
 */

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // TODO Phase 4: aggregate holdings, compute total, insert into portfolio_snapshots

    return new Response(
      JSON.stringify({ ok: true, total_value: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500 }
    );
  }
});
