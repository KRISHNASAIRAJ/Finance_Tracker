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
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      .select("id, user_id, symbol, fund_name, type, allocation_category, quantity, current_price, current_value");

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
      const allocation: Record<string, number> = {};

      for (const h of userHoldings) {
        const price = Number(h.current_price) || 0;
        const value = Number(h.quantity) * price;
        totalValue += Math.round(value);
        const cat = (h.allocation_category as string) || h.type || 'Other';
        allocation[cat] = (allocation[cat] || 0) + Math.round(value);
      }

      const { data: prevSnapshot } = await supabase
        .from("portfolio_snapshots")
        .select("total_value")
        .eq("user_id", userId)
        .eq("date", yesterday)
        .single();

      let dayChange = 0;
      let dayChangePct = 0;
      if (prevSnapshot?.total_value) {
        const prevVal = Number(prevSnapshot.total_value);
        dayChange = totalValue - prevVal;
        dayChangePct = prevVal > 0
          ? (dayChange / prevVal) * 100
          : 0;
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
