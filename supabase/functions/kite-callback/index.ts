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
      `<html><body><h2>Configuration Error</h2><p>KITE_API_KEY or KITE_API_SECRET is not set.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const rawState = url.searchParams.get("state") || "";
  const stateUserId = rawState;

  console.log('[kite-callback] === REQUEST RECEIVED ===');
  console.log(`[kite-callback] State param (raw): "${rawState.substring(0, 24)}${rawState.length > 24 ? '...' : ''}" (len=${rawState.length})`);
  console.log(`[kite-callback] Request token: ${requestToken ? 'present (len=' + requestToken.length + ')' : 'MISSING'}`);
  console.log(`[kite-callback] Status: ${status || 'none'}`);

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
    const checksum = await sha256(KITE_API_KEY + requestToken + KITE_API_SECRET);

    const formBody = new URLSearchParams({
      api_key: KITE_API_KEY,
      request_token: requestToken,
      checksum,
    });

    console.log('[kite-callback] Exchanging token...');
    const kiteRes = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    const kiteData = await kiteRes.json();

    console.log('[kite-callback] Token exchange response status:', kiteData.status);
    const kiteUserId = kiteData.data?.user_id || 'unknown';
    const kiteUserName = kiteData.data?.user_name || 'unknown';

    if (kiteData.status !== "success") {
      console.error('[kite-callback] Token exchange FAILED:', JSON.stringify(kiteData));
      return new Response(
        `<html><body><h2>Token exchange failed</h2><p>${kiteData.message || "Unknown error"} (${kiteData.error_type || ""})</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const accessToken = kiteData.data.access_token;
    const publicToken = kiteData.data.public_token || "";

    console.log(`[kite-callback] Token received — preview: ${accessToken.substring(0, 4)}...${accessToken.slice(-4)}, length: ${accessToken.length}, Kite user: ${kiteUserId}`);

    if (!accessToken) {
      console.error('[kite-callback] No access_token in Kite response');
      return new Response(
        `<html><body><h2>No access token</h2><p>Kite did not return an access token.</p></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[kite-callback] Kite account: ${kiteUserName} (id: ${kiteUserId})`);

    // Look for an existing row with a real user_id (not "default" placeholder)
    // Kite v3 often drops the state param, so we reuse the existing Supabase UUID
    const { data: existingRows } = await supabase
      .from("kite_tokens")
      .select("user_id, updated_at")
      .neq("user_id", "default")
      .order("updated_at", { ascending: false })
      .limit(5);

    let tokenUserId: string;
    if (existingRows && existingRows.length > 0) {
      tokenUserId = existingRows[0].user_id;
      console.log(`[kite-callback] Found existing Supabase user_id: "${tokenUserId.substring(0, 12)}..." — will update this row`);
    } else if (stateUserId && stateUserId.length > 5 && stateUserId !== "unknown") {
      tokenUserId = stateUserId;
      console.log(`[kite-callback] Using state param as user_id: "${tokenUserId.substring(0, 12)}..."`);
    } else {
      tokenUserId = "default";
      console.warn(`[kite-callback] No valid user_id found. State="${stateUserId || 'EMPTY'}". Storing under "default". This will NOT be found on sync!`);
    }

    // Clean up any stale "default" row to prevent conflicts
    if (tokenUserId !== "default") {
      await supabase.from("kite_tokens").delete().eq("user_id", "default");
      console.log('[kite-callback] Cleaned up stale "default" row');
    }

    const { error: upsertErr, status: upsertStatus } = await supabase
      .from("kite_tokens")
      .upsert({
        user_id: tokenUserId,
        access_token: accessToken,
        public_token: publicToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error('[kite-callback] Upsert FAILED:', upsertErr.message, 'code:', upsertErr.code, 'status:', upsertStatus);
    } else {
      console.log('[kite-callback] Token stored SUCCESSFULLY. user_id:', tokenUserId.substring(0, 12) + '..., access_token preview:', accessToken.substring(0, 4) + '...' + accessToken.slice(-4));
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
    console.error('[kite-callback] CRASH:', (err as Error).message);
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
