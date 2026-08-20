/**
 * portfolio-snapshot Edge Function
 *
 * Phase 4: Computes daily portfolio snapshot for all users.
 * Triggered by pg_cron (8:30 PM IST = 15:00 UTC daily) or manual POST.
 *
 * Deploy: supabase functions deploy portfolio-snapshot
 * Cron: SELECT cron.schedule('portfolio-snapshot', '0 15 * * *',
 *   $$SELECT net.http_post('https://<project-ref>.supabase.co/functions/v1/portfolio-snapshot', '{}')$$);
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  fund_name: string | null;
  type: string;
  quantity: number;
  current_price: number | null;
  current_value: number | null;
  prev_close: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Refresh live prices first so the snapshot reflects today's market moves.
    try {
      const refreshResp = await fetch(`${supabaseUrl}/functions/v1/refresh-portfolio-prices`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const refreshBody = await refreshResp.json();
      console.log("refresh-portfolio-prices:", JSON.stringify(refreshBody).substring(0, 300));
    } catch (refreshErr) {
      console.warn("refresh-portfolio-prices failed (snapshot continues with existing prices):", (refreshErr as Error).message);
    }

    const today = new Date().toISOString().split("T")[0];

    const dayOfWeek = new Date().getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ ok: true, date: today, skipped: "weekend", message: "Markets closed on Saturday and Sunday" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const { data: holdings, error: holdingsErr } = await supabase
      .from("holdings")
      .select("id, user_id, symbol, fund_name, type, allocation_category, quantity, current_price, current_value, prev_close");

    if (holdingsErr || !holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No holdings found", users: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const byUser = new Map<string, Holding[]>();
    for (const h of holdings as Holding[]) {
      const list = byUser.get(h.user_id) || [];
      list.push(h);
      byUser.set(h.user_id, list);
    }

    const results: Record<string, unknown>[] = [];

    for (const [userId, userHoldings] of byUser) {
      let totalValue = 0;
      let prevCloseValue = 0;
      let hasPrevClose = false;
      const allocation: Record<string, number> = {};

      for (const h of userHoldings) {
        const price = Number(h.current_price) || 0;
        const value = Number(h.quantity) * price;
        totalValue += Math.round(value);
        const cat = (h.allocation_category as string) || h.type || 'Other';
        allocation[cat] = (allocation[cat] || 0) + Math.round(value);
        if (Number(h.prev_close) > 0) {
          hasPrevClose = true;
          prevCloseValue += Number(h.quantity) * Number(h.prev_close);
        }
      }

      let dayChange = 0;
      let dayChangePct = 0;

      // Fetch the latest snapshot for comparison
      const { data: latestSnap } = await supabase
        .from("portfolio_snapshots")
        .select("total_value, date")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestValue = latestSnap?.total_value ? Number(latestSnap.total_value) : null;

      // Prefer per-holding prev_close (true market move for the day).
      if (hasPrevClose) {
        dayChange = Math.round(totalValue - prevCloseValue);
        dayChangePct = prevCloseValue > 0 ? (dayChange / prevCloseValue) * 100 : 0;
      } else if (latestValue) {
        dayChange = totalValue - latestValue;
        dayChangePct = latestValue > 0 ? (dayChange / latestValue) * 100 : 0;
      }

      // If the value hasn't changed, don't add a new snapshot row —
      // slide the latest snapshot's date forward instead so the history
      // doesn't accumulate duplicate-value entries.
      if (latestValue !== null && latestValue === totalValue && latestSnap.date !== today) {
        const { error: slideErr } = await supabase
          .from("portfolio_snapshots")
          .update({ date: today, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("date", latestSnap.date);

        if (slideErr) {
          console.error(`Failed to slide snapshot date for ${userId}:`, slideErr.message);
        } else {
          results.push({
            user_id: userId,
            total_value: totalValue,
            day_change: 0,
            day_change_pct: 0,
            holdings_count: userHoldings.length,
            unchanged: true,
          });
          continue;
        }
      }

      const { error: upsertErr } = await supabase
        .from("portfolio_snapshots")
        .upsert({
          user_id: userId,
          date: today,
          total_value: totalValue,
          day_change: dayChange,
          day_change_pct: dayChangePct,
          allocation_json: allocation,
          created_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });

      if (upsertErr) {
        console.error(`Failed to upsert snapshot for ${userId}:`, upsertErr.message);
      }

      results.push({
        user_id: userId,
        total_value: totalValue,
        day_change: dayChange,
        day_change_pct: dayChangePct,
        holdings_count: userHoldings.length,
      });

      // Update goal progress from linked holdings
      const { data: goals } = await supabase
        .from("investment_goals")
        .select("id, linked_holding_ids")
        .eq("user_id", userId);

      if (goals && goals.length > 0) {
        for (const goal of goals) {
          const linkedIds = goal.linked_holding_ids as string[] | null;
          if (!linkedIds || linkedIds.length === 0) continue;

          let goalValue = 0;
          for (const hid of linkedIds) {
            const holding = userHoldings.find((h) => h.id === hid);
            if (holding) {
              const price = Number(holding.current_price) || 0;
              goalValue += Math.round(Number(holding.quantity) * price);
            }
          }

          await supabase
            .from("investment_goals")
            .update({ current_progress: goalValue, updated_at: new Date().toISOString() })
            .eq("id", goal.id);
        }
      }

      // Send FCM push notification via Expo Push API
      try {
        const { data: tokens } = await supabase
          .from("device_tokens")
          .select("token")
          .eq("user_id", userId);

        if (tokens && tokens.length > 0) {
          const roundedL = (totalValue / 100000).toFixed(1);
          const prefix = dayChange >= 0 ? '+' : '';
          const body = `₹${roundedL}L · ${prefix}${dayChangePct.toFixed(1)}% today`;

          for (const t of tokens) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: t.token,
                title: "Portfolio Update",
                body,
                data: { type: "PORTFOLIO_REPORT", date: today },
                priority: "high",
              }),
            });
          }
        }
      } catch (pushErr) {
        console.warn("Push notification skipped:", (pushErr as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: today,
        users: byUser.size,
        results,
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
