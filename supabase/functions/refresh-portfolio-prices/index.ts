/**
 * refresh-portfolio-prices Edge Function
 *
 * Fetches live prices for all holdings and updates current_price:
 * - Equity/ETF: Yahoo Finance chart API (regularMarketPrice)
 * - Mutual funds: AMFI NAV API (api.mfapi.in)
 *
 * Also tracks prev_close so the app can show today's P&L.
 *
 * Deploy: supabase functions deploy refresh-portfolio-prices
 * Trigger: called by portfolio-snapshot before snapshotting, or manually
 * Secrets: none required (free public APIs)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  type: string;
  quantity: number;
  scheme_code: string | null;
}

async function fetchYahooPrice(
  symbol: string,
): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${
      encodeURIComponent(symbol)
    }?interval=1d&range=1d`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    const body = await resp.json();
    const meta = body?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    const price = Math.round(meta.regularMarketPrice * 100);
    const prevClose = typeof meta.chartPreviousClose === "number"
      ? Math.round(meta.chartPreviousClose * 100)
      : price;
    return { price, prevClose };
  } catch {
    return null;
  }
}

async function fetchAmfiNav(
  schemeCode: string,
): Promise<{ price: number; prevClose: number } | null> {
  try {
    // If the stored value is not a numeric scheme code (Kite stores the
    // scheme name there), resolve it via the AMFI search endpoint first.
    let code = schemeCode.trim();
    if (!/^\d+$/.test(code)) {
      const searchUrl = `https://api.mfapi.in/mf/search?q=${
        encodeURIComponent(code)
      }`;
      const searchResp = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (searchResp.ok) {
        const searchBody = await searchResp.json();
        const match = Array.isArray(searchBody) ? searchBody[0] : null;
        if (match?.schemeCode) code = String(match.schemeCode);
        else return null;
      } else {
        return null;
      }
    }

    const url = `https://api.mfapi.in/mf/${encodeURIComponent(code)}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    const body = await resp.json();
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const price = Math.round(Number(data[0].nav) * 100);
    const prevClose = data.length > 1
      ? Math.round(Number(data[1].nav) * 100)
      : price;
    if (!price || isNaN(price)) return null;
    return { price, prevClose };
  } catch {
    return null;
  }
}

function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.includes(".")) return s; // already has exchange suffix
  return `${s}.NS`; // NSE default
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id || null;
    } catch {
      // no body — refresh everyone
    }

    let query = supabase
      .from("holdings")
      .select("id, user_id, symbol, type, quantity, scheme_code");

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: holdings, error: holdingsErr } = await query;
    if (holdingsErr || !holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No holdings to refresh",
          updated: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    let updated = 0;
    let failed = 0;
    const failures: string[] = [];
    const now = new Date().toISOString();

    for (const h of holdings as Holding[]) {
      let result: { price: number; prevClose: number } | null = null;

      if (h.type === "mf" && h.scheme_code) {
        result = await fetchAmfiNav(h.scheme_code);
      } else if (h.symbol) {
        result = await fetchYahooPrice(normalizeSymbol(h.symbol));
      }

      if (!result) {
        failed++;
        failures.push(
          `${h.symbol} (${h.type}${h.scheme_code ? `/${h.scheme_code}` : ""})`,
        );
        continue;
      }

      // prev_close = the API's actual previous close (yesterday's close),
      // NOT the stale current_price. This gives correct today's P&L.
      const prevClose = result.prevClose;
      const currentValue = Math.round(Number(h.quantity) * result.price);

      const { error: updErr } = await supabase
        .from("holdings")
        .update({
          current_price: result.price,
          prev_close: prevClose,
          current_value: currentValue,
          last_synced_at: now,
          updated_at: now,
        })
        .eq("id", h.id);

      if (updErr) {
        console.error(`Failed to update ${h.id}:`, updErr.message);
        failed++;
        continue;
      }
      updated++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: (holdings as Holding[]).length,
        updated,
        failed,
        failures,
        at: now,
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
