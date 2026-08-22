/**
 * kite-holdings-sync Edge Function
 *
 * Phase 4: Syncs Zerodha holdings via Kite Connect API.
 * Reads access_token from kite_tokens table, calls Kite /portfolio/holdings,
 * upserts into holdings table.
 *
 * Deploy: supabase functions deploy kite-holdings-sync
 * Secrets: KITE_API_KEY, KITE_API_SECRET
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;
const KITE_API_SECRET = Deno.env.get("KITE_API_SECRET")!;

function cleanFundName(raw: string): string {
  return raw
    .replace(/\s*-\s*(DIRECT|REGULAR)\s*PLAN/gi, "")
    .replace(
      /\s*-\s*(GROWTH|DIVIDEND|IDCW|DAILY|WEEKLY|MONTHLY)(\s+OPTION)?/gi,
      "",
    )
    .replace(/\s+FUND$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractAmc(raw: string): string {
  return raw
    .replace(/\s*-\s*(DIRECT|REGULAR)\s*PLAN/gi, "")
    .replace(
      /\s*-\s*(GROWTH|DIVIDEND|IDCW|DAILY|WEEKLY|MONTHLY)(\s+OPTION)?/gi,
      "",
    )
    .replace(/\s+FUND$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getAllocationCategory(
  symbol: string,
  type: string,
  name: string,
): string {
  const s = symbol.toUpperCase();
  const n = name.toUpperCase();
  if (s.includes("GOLDBEES") || s.includes("GOLD") || n.includes("GOLD ETF")) {
    return "Gold";
  }
  if (
    s.includes("EMBASSY") || s.includes("BIRET") || s.includes("REIT") ||
    n.includes("REIT")
  ) return "Realty";
  if (type === "mf") return "Mutual Funds";
  if (type === "etf") return "ETF";
  if (type === "equity") return "Equity";
  return "Other";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!KITE_API_KEY || !KITE_API_SECRET) {
    return new Response(
      JSON.stringify({
        error:
          "KITE_API_KEY or KITE_API_SECRET is not configured. Run: supabase secrets set KITE_API_KEY=xxx KITE_API_SECRET=yyy",
        synced: 0,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKeyPreview = KITE_API_KEY.substring(0, 4) + "...";
  console.log(
    `[kite-holdings-sync] Using Kite API key starting with: ${apiKeyPreview}`,
  );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Read user_id from request body (mobile sends the current user's ID)
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `[kite-holdings-sync] Querying kite_tokens for user_id: ${
        userId.substring(0, 12)
      }...`,
    );

    // List ALL rows in kite_tokens for diagnostic purposes
    const { data: allRows, error: countErr } = await supabase
      .from("kite_tokens")
      .select("user_id, access_token")
      .limit(10);
    console.log(
      `[kite-holdings-sync] Total kite_tokens rows in DB: ${
        allRows?.length ?? 0
      }`,
    );
    if (allRows && allRows.length > 0) {
      for (const r of allRows) {
        const uid = (r.user_id ?? "").substring(0, 12);
        const tok = (r.access_token ?? "").substring(0, 4) + "..." +
          (r.access_token ?? "").slice(-4);
        console.log(
          `[kite-holdings-sync]   DB row: user_id=${uid}, token=${tok}, len=${r.access_token?.length}`,
        );
      }
    }

    // Fetch access token — prefer matching user_id, fallback to first available (legacy tokens)
    let accessToken: string | null = null;
    let tokenSource = "unknown";

    const { data: matchedRows, error: matchErr } = await supabase
      .from("kite_tokens")
      .select("access_token, user_id")
      .eq("user_id", userId);

    if (matchErr) {
      console.error("kite_tokens lookup error:", matchErr.message);
    }

    if (matchedRows && matchedRows.length > 0) {
      accessToken = matchedRows[0].access_token;
      tokenSource = "exact_match";
      console.log(`[kite-holdings-sync] Token found by exact user_id match`);
    } else {
      // Legacy fallback: old tokens stored with Kite internal ID as user_id
      const { data: legacyRows, error: legacyErr } = await supabase
        .from("kite_tokens")
        .select("access_token, user_id")
        .limit(1);

      if (legacyErr || !legacyRows || legacyRows.length === 0) {
        return new Response(
          JSON.stringify({
            error: "No Kite token found. Please connect Kite first.",
            synced: 0,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      accessToken = legacyRows[0].access_token;
      tokenSource = "legacy_fallback";
      // Migrate: update the legacy token's user_id to match the requesting user
      const legacyUserId = legacyRows[0].user_id;
      console.log(
        `[kite-holdings-sync] Token found by LEGACY FALLBACK — stored user_id="${
          legacyUserId?.substring(0, 12)
        }...", request user_id="${userId.substring(0, 12)}..."`,
      );
      if (legacyUserId !== userId) {
        await supabase
          .from("kite_tokens")
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq("user_id", legacyUserId);
        console.log(
          `Migrated kite_tokens user_id from "${legacyUserId}" to "${userId}"`,
        );
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "No Kite token found. Please connect Kite first.",
          synced: 0,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const tokPreview = accessToken.substring(0, 4) + "..." +
      accessToken.slice(-4);
    console.log(
      `[kite-holdings-sync] Token preview: ${tokPreview}, length: ${accessToken.length}, source: ${tokenSource}`,
    );
    console.log(
      `[kite-holdings-sync] Auth header key prefix: ${
        KITE_API_KEY.substring(0, 5)
      }...`,
    );

    const authHeader = `token ${KITE_API_KEY}:${accessToken}`;

    // Verify token validity via lightweight Kite profile endpoint first
    try {
      const profileRes = await fetch("https://api.kite.trade/user/profile", {
        headers: { Authorization: authHeader },
      });
      const profileData = await profileRes.json();
      if (profileData.status !== "success") {
        console.error(
          `[kite-holdings-sync] Token verification FAILED — message: ${
            profileData.message || "unknown"
          }, code: ${profileData.error_code || "none"}`,
        );
        return new Response(
          JSON.stringify({
            error:
              `Kite token invalid — please tap "Connect Kite" to re-authenticate. (${
                profileData.message || "token rejected"
              })`,
            synced: 0,
            needsReconnect: true,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      console.log(
        `[kite-holdings-sync] Token verified — user: ${
          profileData.data?.user_name || "unknown"
        }`,
      );
    } catch (profileErr: any) {
      console.warn(
        `[kite-holdings-sync] Profile check network error: ${
          profileErr?.message ?? profileErr
        }`,
      );
    }

    // Fetch equity holdings from Kite Connect
    const kiteRes = await fetch("https://api.kite.trade/portfolio/holdings", {
      headers: {
        Authorization: authHeader,
      },
    });

    const kiteData = await kiteRes.json();

    if (kiteData.status !== "success") {
      const errMsg = kiteData.message || "Unknown Kite error";
      console.error(
        `[kite-holdings-sync] Kite API error — message: ${errMsg}, code: ${
          kiteData.error_code || "none"
        }`,
      );
      return new Response(
        JSON.stringify({
          error:
            `Kite API: ${errMsg}. Try tapping "Connect Kite" to re-authenticate.`,
          synced: 0,
          needsReconnect: true,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const equityHoldings = kiteData.data || [];
    const now = new Date().toISOString();
    let synced = 0;

    // Load existing prev_close values so a Kite re-sync doesn't wipe today's P&L anchor.
    const { data: existingRows } = await supabase
      .from("holdings")
      .select("symbol, prev_close")
      .eq("user_id", userId);
    const existingPrevClose: Record<string, number | null> = {};
    for (
      const row of (existingRows as Array<
        { symbol: string; prev_close: number | null }
      >) || []
    ) {
      existingPrevClose[row.symbol] = row.prev_close;
    }

    for (const h of equityHoldings) {
      const symbol = h.tradingsymbol as string;
      const quantity = Number(h.quantity) || 0;
      const avgBuyPrice = Math.round(Number(h.average_price) * 100);
      const currentPrice = Math.round(Number(h.last_price) * 100);
      const currentValue = Math.round(Number(h.last_price) * quantity * 100);
      const rawType = (h.instrument_type as string) || "";
      const type = rawType === "ETF"
        ? "etf" as const
        : rawType === "MF"
        ? "mf" as const
        : "equity" as const;
      const alloc = getAllocationCategory(
        symbol,
        type,
        h.tradingsymbol as string,
      );

      const { error: upsertErr } = await supabase
        .from("holdings")
        .upsert({
          user_id: userId,
          symbol,
          fund_name: h.tradingsymbol as string,
          type,
          allocation_category: alloc,
          quantity,
          avg_buy_price: avgBuyPrice,
          current_price: currentPrice,
          prev_close: existingPrevClose[symbol] ?? currentPrice,
          current_value: currentValue,
          source: "kite_sync",
          last_synced_at: now,
          updated_at: now,
        }, { onConflict: "user_id,symbol" });

      if (!upsertErr) synced++;
      else {console.error(
          `Failed to upsert equity ${symbol}:`,
          upsertErr.message,
        );}
    }

    // Fetch MF holdings from Zerodha Coin (separate endpoint)
    let mfSynced = 0;
    try {
      const mfRes = await fetch("https://api.kite.trade/mf/holdings", {
        headers: {
          Authorization: authHeader,
        },
      });

      const mfData = await mfRes.json();

      if (mfData.status === "success") {
        const mfHoldings = mfData.data || [];

        for (const mf of mfHoldings) {
          const symbol = (mf.tradingsymbol as string) || (mf.fund as string);
          const quantity = Number(mf.quantity) || 0;
          const avgBuyPrice = Math.round(Number(mf.average_price) * 100);
          const currentPrice = Math.round(Number(mf.last_price) * 100);
          const currentValue = Math.round(
            Number(mf.last_price) * quantity * 100,
          );
          const folio = mf.folio as string | undefined;
          const isin = (mf.isin as string) || (mf.tradingsymbol as string) ||
            undefined;
          const schemeName = mf.scheme_name as string | undefined;
          const fundHouse = (mf.fund as string) || undefined;
          const fundName = cleanFundName(schemeName || fundHouse || symbol);
          const amc = fundHouse && fundHouse !== (schemeName || "")
            ? extractAmc(fundHouse)
            : fundName;
          const alloc = getAllocationCategory(symbol, "mf", fundName);

          const { error: upsertErr } = await supabase
            .from("holdings")
            .upsert({
              user_id: userId,
              symbol,
              fund_name: fundName,
              type: "mf",
              allocation_category: alloc,
              quantity,
              avg_buy_price: avgBuyPrice,
              current_price: currentPrice,
              current_value: currentValue,
              source: "kite_sync",
              folio_number: folio || null,
              amc,
              scheme_code: schemeName || null,
              isin: isin || null,
              last_synced_at: now,
              updated_at: now,
            }, { onConflict: "user_id,symbol" });

          if (!upsertErr) mfSynced++;
          else {console.error(
              `Failed to upsert MF ${symbol}:`,
              upsertErr.message,
            );}
        }
      } else {
        console.warn(
          "MF holdings fetch warning:",
          mfData.message || "Could not fetch MF holdings",
        );
      }
    } catch (mfErr) {
      console.warn(
        "MF holdings fetch failed (may not have Coin account):",
        (mfErr as Error).message,
      );
    }

    return new Response(
      JSON.stringify({
        synced,
        mfSynced,
        total: equityHoldings.length + mfSynced,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
