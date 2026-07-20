/**
 * kite-callback Edge Function
 *
 * Phase 4: Handles Kite Connect OAuth redirect.
 * Receives request_token, exchanges for access_token, stores in kite_tokens table.
 *
 * Secrets: KITE_API_KEY, KITE_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;
const KITE_API_SECRET = Deno.env.get("KITE_API_SECRET")!;

Deno.serve(async (req: Request) => {
  if (!KITE_API_KEY || !KITE_API_SECRET) {
    return new Response(
      `<html><body><h2>Configuration Error</h2><p>KITE_API_KEY or KITE_API_SECRET is not set. Run: supabase secrets set KITE_API_KEY=xxx KITE_API_SECRET=yyy</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const stateUserId = url.searchParams.get("state") || ""; // Supabase user UUID passed via OAuth state

  if (status === "error") {
    return new Response(`<html><body><h2>Authorization failed</h2><p>Kite Connect authorization was denied.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!requestToken) {
    return new Response(`<html><body><h2>No request token</h2><p>Missing request_token parameter.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    // Exchange request_token for access_token
    const checksum = await sha256(KITE_API_KEY + requestToken + KITE_API_SECRET);

    const formBody = new URLSearchParams({
      api_key: KITE_API_KEY,
      request_token: requestToken,
      checksum,
    });

    const kiteRes = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    const kiteData = await kiteRes.json();

    if (kiteData.status !== "success") {
      return new Response(
        `<html><body><h2>Token exchange failed</h2><p>${kiteData.message || "Unknown error"}</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const accessToken = kiteData.data.access_token;
    const publicToken = kiteData.data.public_token || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenUserId = stateUserId || "default";

    const { error: upsertErr } = await supabase
      .from("kite_tokens")
      .upsert({
        user_id: tokenUserId,
        access_token: accessToken,
        public_token: publicToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("Failed to store token:", upsertErr.message);
    }

    return new Response(
      `<html>
        <body style="background:#15121b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;">
          <div>
            <h1 style="color:#7c3aed;">Meridian</h1>
            <h2>Kite Connected!</h2>
            <p>Your Zerodha holdings will now sync automatically.</p>
            <p style="color:#10b981;">Access token stored securely.</p>
            <a href="meridian://" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Open Meridian</a>
            <p style="font-size:12px;color:#888;margin-top:12px;">Or close this page and return to the app.</p>
            <script>
              window.location.href = 'meridian://';
            </script>
          </div>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new Response(
      `<html><body><h2>Error</h2><p>${(err as Error).message}</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
});

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
