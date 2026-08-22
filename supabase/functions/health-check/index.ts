/**
 * health-check Edge Function
 *
 * Tiny endpoint used by CI smoke tests to verify a deploy succeeded.
 * Returns 200 with status payload; no auth required.
 *
 * Deploy: supabase functions deploy health-check
 */

const headers = { "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve((request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return reply(405, {
      error: "method_not_allowed",
      allowed_methods: ["GET", "HEAD"],
    });
  }

  return reply(200, {
    status: "ok",
    service: "meridian",
    timestamp: new Date().toISOString(),
  });
});
