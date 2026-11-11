/**
 * refresh-portfolio-prices Edge Function
 *
 * Fetches live prices for all holdings and updates current_price:
 * - Equity/ETF: Yahoo Finance chart API (regularMarketPrice)
 * - Mutual funds: AMFI NAVs (api.mfapi.in for the NAV history)
 *
 * Also tracks prev_close so the app can show today's P&L for every asset
 * class — equity AND mutual funds.
 *
 * Mutual funds are resolved to their AMFI scheme code in this order:
 *   1. holdings.scheme_code (a numeric code, or a name resolved via search)
 *   2. holdings.isin / holdings.symbol (the ISIN) → the AMFI NAV list
 * Without step 2 a fund that only carries its ISIN could never be priced,
 * and it silently lost its day change.
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
  isin: string | null;
}

/** AMFI entry for one fund: the scheme code plus the latest published NAV. */
interface AmfiFund {
  schemeCode: string;
  nav: number;
  date: string;
}

/** ISIN → fund, built once per run from the official AMFI NAV list. */
let amfiIndex: Map<string, AmfiFund> | null = null;

async function fetchYahooPrice(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    const body = await resp.json();
    const meta = body?.chart?.result?.[0]?.meta;
    const rawPrice = Number(meta?.regularMarketPrice);
    if (!meta || !Number.isFinite(rawPrice) || rawPrice <= 0) return null;
    const price = Math.round(rawPrice * 100);
    const rawPrev = Number(meta.chartPreviousClose);
    const prevClose = Number.isFinite(rawPrev) && rawPrev > 0 ? Math.round(rawPrev * 100) : price;
    return { price, prevClose };
  } catch {
    return null;
  }
}

/** Resolve a fund name (Kite stores the name) to its AMFI scheme code. */
async function searchSchemeCode(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`;
    const searchResp = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!searchResp.ok) return null;
    const searchBody = await searchResp.json();
    const match = Array.isArray(searchBody) ? searchBody[0] : null;
    return match?.schemeCode ? String(match.schemeCode) : null;
  } catch {
    return null;
  }
}

/**
 * The official AMFI NAV list — every scheme with its ISINs and the latest
 * NAV. Used to resolve a fund that only carries its ISIN.
 */
async function fetchAmfiIndex(): Promise<Map<string, AmfiFund>> {
  if (amfiIndex) return amfiIndex;
  const index = new Map<string, AmfiFund>();
  try {
    const resp = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!resp.ok) throw new Error(`AMFI ${resp.status}`);
    const text = await resp.text();
    for (const line of text.split(/\r?\n/)) {
      // Scheme Code;ISIN Div Payout/ Growth;ISIN Div Reinvestment;Name;Plan;Option;NAV;Date
      const parts = line.split(";");
      if (parts.length < 8) continue;
      const schemeCode = parts[0].trim();
      const nav = Number(parts[6]);
      if (!/^\d+$/.test(schemeCode) || !Number.isFinite(nav) || nav <= 0) continue;
      const fund: AmfiFund = { schemeCode, nav, date: parts[7].trim() };
      // A scheme can be reached through two ISIN columns (payout + reinvest).
      for (const column of [parts[1], parts[2]]) {
        for (const isin of column.split(",")) {
          const key = isin.trim().toUpperCase();
          if (key && key !== "-" && !index.has(key)) index.set(key, fund);
        }
      }
    }
  } catch (e) {
    console.error("AMFI NAV list failed:", (e as Error).message);
  }
  amfiIndex = index;
  return index;
}

/** Does this look like an ISIN (e.g. INF247L01HC6)? */
function looksLikeIsin(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  return /^INF[0-9A-Z]{9}$/.test(v);
}

/** The ISIN of a holding — either the column or the symbol it was stored in. */
function holdingIsin(h: Holding): string | null {
  if (looksLikeIsin(h.isin)) return h.isin!.trim().toUpperCase();
  if (looksLikeIsin(h.symbol)) return h.symbol.trim().toUpperCase();
  return null;
}

/** Find the AMFI scheme code for a mutual fund holding. */
async function resolveSchemeCode(h: Holding): Promise<string | null> {
  const code = (h.scheme_code || "").trim();
  if (code) {
    if (/^\d+$/.test(code)) return code;
    // Kite stores the scheme name there — resolve it via the search.
    const resolved = await searchSchemeCode(code);
    if (resolved) return resolved;
  }
  const isin = holdingIsin(h);
  if (!isin) return null;
  const index = await fetchAmfiIndex();
  return index.get(isin)?.schemeCode ?? null;
}

/** Latest + previous NAV for a scheme (both in paise). */
async function fetchAmfiNav(schemeCode: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return null;
    const body = await resp.json();
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const rawNav = Number(data[0]?.nav);
    if (!Number.isFinite(rawNav) || rawNav <= 0) return null;
    const price = Math.round(rawNav * 100);
    // The previous entry is the previous trading day's NAV — the day change
    // of a fund is NAV to NAV.
    const rawPrevNav = data.length > 1 ? Number(data[1]?.nav) : NaN;
    const prevClose = Number.isFinite(rawPrevNav) && rawPrevNav > 0 ? Math.round(rawPrevNav * 100) : price;
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
      .select("id, user_id, symbol, type, quantity, scheme_code, isin");

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: holdings, error: holdingsErr } = await query;
    if (holdingsErr || !holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No holdings to refresh", updated: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let failed = 0;
    const failures: string[] = [];
    const details: Array<{ symbol: string; type: string; price: number; prevClose: number }> = [];
    const now = new Date().toISOString();

    for (const h of holdings as Holding[]) {
      let result: { price: number; prevClose: number } | null = null;

      if (h.type === "mf") {
        // Mutual funds are priced from their AMFI scheme (resolved via the
        // scheme code or the ISIN) — never from the equity price feed.
        const schemeCode = await resolveSchemeCode(h);
        if (schemeCode) {
          result = await fetchAmfiNav(schemeCode);
        }
      } else if (h.symbol) {
        result = await fetchYahooPrice(normalizeSymbol(h.symbol));
      }

      if (!result) {
        failed++;
        failures.push(`${h.symbol} (${h.type}${h.scheme_code ? `/${h.scheme_code}` : ''})`);
        continue;
      }

      // prev_close = the API's actual previous close (yesterday's close),
      // NOT the stale current_price. This gives correct today's P&L.
      const prevClose = result.prevClose;
      const rawQty = Number(h.quantity);
      const quantity = Number.isFinite(rawQty) ? rawQty : 0;
      const currentValue = Math.round(quantity * result.price);

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
      details.push({
        symbol: h.symbol,
        type: h.type,
        price: result.price,
        prevClose,
      });
      updated++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: (holdings as Holding[]).length,
        updated,
        failed,
        failures,
        details,
        at: now,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
