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
    .replace(/\s*-\s*(GROWTH|DIVIDEND|IDCW|DAILY|WEEKLY|MONTHLY)(\s+OPTION)?/gi, "")
    .replace(/\s+FUND$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractAmc(raw: string): string {
  return raw
    .replace(/\s*-\s*(DIRECT|REGULAR)\s*PLAN/gi, "")
    .replace(/\s*-\s*(GROWTH|DIVIDEND|IDCW|DAILY|WEEKLY|MONTHLY)(\s+OPTION)?/gi, "")
    .replace(/\s+FUND$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getAllocationCategory(symbol: string, type: string, name: string): string {
  const s = symbol.toUpperCase();
  const n = name.toUpperCase();
  if (s.includes('GOLDBEES') || s.includes('GOLD') || n.includes('GOLD ETF')) return 'Gold';
  if (s.includes('EMBASSY') || s.includes('BIRET') || s.includes('REIT') || n.includes('REIT')) return 'Realty';
  if (type === 'mf') return 'Mutual Funds';
  if (type === 'etf') return 'ETF';
  if (type === 'equity') return 'Equity';
  return 'Other';
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

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

    // Fetch access token from kite_tokens (personal app: use first available)
    const { data: tokenRows, error: tokenErr } = await supabase
      .from("kite_tokens")
      .select("access_token, user_id")
      .limit(1);

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No Kite token. Please connect Kite first.", synced: 0 }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenRows[0].access_token;

    // Fetch equity holdings from Kite Connect
    const kiteRes = await fetch("https://api.kite.trade/portfolio/holdings", {
      headers: {
        Authorization: `token ${KITE_API_KEY}:${accessToken}`,
      },
    });

    const kiteData = await kiteRes.json();

    if (kiteData.status !== "success") {
      return new Response(
        JSON.stringify({ error: kiteData.message || "Kite API error", synced: 0 }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const equityHoldings = kiteData.data || [];
    const now = new Date().toISOString();
    let synced = 0;

    for (const h of equityHoldings) {
      const symbol = h.tradingsymbol as string;
      const quantity = Number(h.quantity) || 0;
      const avgBuyPrice = Math.round(Number(h.average_price) * 100);
      const currentPrice = Math.round(Number(h.last_price) * 100);
      const currentValue = Math.round(Number(h.last_price) * quantity * 100);
      const rawType = (h.instrument_type as string) || '';
      const type = rawType === 'ETF' ? 'etf' as const
        : rawType === 'MF' ? 'mf' as const
        : 'equity' as const;
      const alloc = getAllocationCategory(symbol, type, h.tradingsymbol as string);

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
          current_value: currentValue,
          source: "kite_sync",
          last_synced_at: now,
          updated_at: now,
        }, { onConflict: "user_id,symbol" });

      if (!upsertErr) synced++;
      else console.error(`Failed to upsert equity ${symbol}:`, upsertErr.message);
    }

    // Fetch MF holdings from Zerodha Coin (separate endpoint)
    let mfSynced = 0;
    try {
      const mfRes = await fetch("https://api.kite.trade/mf/holdings", {
        headers: {
          Authorization: `token ${KITE_API_KEY}:${accessToken}`,
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
          const currentValue = Math.round(Number(mf.last_price) * quantity * 100);
          const folio = mf.folio as string | undefined;
          const isin = (mf.isin as string) || (mf.tradingsymbol as string) || undefined;
          const schemeName = mf.scheme_name as string | undefined;
          const fundHouse = (mf.fund as string) || undefined;
          const fundName = cleanFundName(schemeName || fundHouse || symbol);
          const amc = fundHouse && fundHouse !== (schemeName || "") ? extractAmc(fundHouse) : fundName;
          const alloc = getAllocationCategory(symbol, 'mf', fundName);

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
          else console.error(`Failed to upsert MF ${symbol}:`, upsertErr.message);
        }
      } else {
        console.warn("MF holdings fetch warning:", mfData.message || "Could not fetch MF holdings");
      }
    } catch (mfErr) {
      console.warn("MF holdings fetch failed (may not have Coin account):", (mfErr as Error).message);
    }

    return new Response(
      JSON.stringify({ synced, mfSynced, total: equityHoldings.length + mfSynced }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
