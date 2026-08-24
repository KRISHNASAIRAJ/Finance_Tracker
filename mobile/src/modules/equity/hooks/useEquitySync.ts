/**
 * Equity sync hook — pushes/pulls holdings, goals and snapshots to/from Supabase
 * with offline seed data and bidirectional queue integration.
 */
import { useCallback, useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import { enqueue } from "../../../services/syncQueue";
import { useInvestmentsStore, Holding, InvestmentGoal } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasEquitySeeded = false;

export function useEquitySync() {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    loading: true,
    error: null,
    lastSyncAt: null,
  });
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;
    doFullSync(user.id);
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    _hasEquitySeeded = true;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

export async function syncEquityNow(userId: string): Promise<SyncState> {
  _hasEquitySeeded = true;
  let state: SyncState = { loading: true, error: null, lastSyncAt: null };
  const setter: Dispatch<SetStateAction<SyncState>> = ((s: SetStateAction<SyncState>) => {
    if (typeof s === 'function') {
      state = (s as (prev: SyncState) => SyncState)(state);
    } else {
      Object.assign(state, s);
    }
  }) as Dispatch<SetStateAction<SyncState>>;
  await doPull(userId);
  state.loading = false;
  state.lastSyncAt = new Date();
  return state;
}

async function doFullSync(userId: string) {
  _hasEquitySeeded = true;
  await doPull(userId);
}

async function doPull(userId: string) {
  const store = useInvestmentsStore;

  // --- HOLDINGS ---
  const { data: holdingsData, error: holdingsErr } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", userId);

  if (!holdingsErr && holdingsData && holdingsData.length > 0) {
    const merged: Holding[] = (holdingsData as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      symbol: r.symbol as string,
      name: (r.fund_name as string) ?? (r.symbol as string),
      type: (r.type as Holding["type"]) ?? "equity",
      quantity: Number(r.quantity) || 0,
      avgPrice: (r.avg_buy_price as number) ?? 0,
      currentPrice: (r.current_price as number) ?? 0,
      prevClose: (r.prev_close as number) ?? undefined,
      source: (r.source as Holding["source"]) ?? "manual",
      folio: (r.folio_number as string) ?? undefined,
      amc: (r.amc as string) ?? undefined,
      schemeCode: (r.scheme_code as string) ?? undefined,
      isin: (r.isin as string) ?? undefined,
      sipAmount: (r.sip_amount as number) ?? undefined,
      sipDay: (r.sip_day as number) ?? undefined,
      allocation: (r.allocation_category as string) ?? undefined,
    }));
    store.setState({ holdings: merged });
  } else if (holdingsData && holdingsData.length === 0) {
    await seedHoldings(userId);
  }

  // Push only holdings missing in cloud (brand-new offline holdings)
  const cloudHoldingIds = new Set((holdingsData ?? []).map((r: any) => r.id as string));
  const localOnlyHoldings = store.getState().holdings.filter((h) => !cloudHoldingIds.has(h.id));
  if (localOnlyHoldings.length > 0) {
    const rows = localOnlyHoldings.map((h) => ({
      id: h.id, user_id: userId, symbol: h.symbol,
      fund_name: h.name, type: h.type, quantity: h.quantity,
      avg_buy_price: h.avgPrice, current_price: h.currentPrice,
      prev_close: h.prevClose ?? null,
      current_value: h.quantity * h.currentPrice, source: h.source,
      updated_at: new Date().toISOString(),
      folio_number: h.folio || null,
      amc: h.amc || null,
      scheme_code: h.schemeCode || null,
      isin: h.isin || null,
      sip_amount: h.sipAmount || null,
      sip_day: h.sipDay || null,
      allocation_category: h.allocation || null,
    }));
    supabase.from("holdings").upsert(rows, { onConflict: "id" }).then(({ error }) => {
      if (error) console.warn('[EquitySync] pushMissing holdings:', error.message);
    });
  }

  // --- INVESTMENT GOALS ---
  const { data: goalsData, error: goalsErr } = await supabase
    .from("investment_goals")
    .select("*")
    .eq("user_id", userId);

  if (!goalsErr && goalsData && goalsData.length > 0) {
    const goals: InvestmentGoal[] = (goalsData as Array<Record<string, unknown>>)
      .map((r) => ({
        id: r.id as string,
        name: r.goal_name as string,
        target: (r.target_amount as number) ?? 0,
        current: (r.current_progress as number) ?? 0,
        dueDate: (r.target_date as string) ?? "",
        priority: (r.priority as InvestmentGoal["priority"]) ?? "medium",
      }));
    store.setState({ goals });
  } else if (_hasEquitySeeded && goalsData && goalsData.length === 0) {
    store.setState({ goals: [] });
  }

  // Push only goals missing in cloud
  const cloudGoalIds = new Set((goalsData ?? []).map((r: any) => r.id as string));
  const localOnlyGoals = store.getState().goals.filter((g) => !cloudGoalIds.has(g.id));
  if (localOnlyGoals.length > 0) {
    const rows = localOnlyGoals.map((g) => ({
      id: g.id, user_id: userId, goal_name: g.name,
      target_amount: g.target, current_progress: g.current,
      target_date: g.dueDate, priority: g.priority,
      updated_at: new Date().toISOString(),
    }));
    supabase.from("investment_goals").upsert(rows, { onConflict: "id" }).then(({ error }) => {
      if (error) console.warn('[EquitySync] pushMissing goals:', error.message);
    });
  }

  // --- PORTFOLIO SNAPSHOTS ---
  const { data: snapData, error: snapErr } = await supabase
    .from("portfolio_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (!snapErr && snapData && snapData.length > 0) {
    const mapped = (snapData as Array<Record<string, unknown>>).map((r) => ({
      date: r.date as string,
      totalValue: (r.total_value as number) ?? 0,
      dayChange: (r.day_change as number) ?? 0,
      dayChangePct: (r.day_change_pct as number) ?? 0,
      allocation: (r.allocation_json as Record<string, number>) ?? {},
    }));
    store.setState({ snapshots: mapped });
  }

  // --- PORTFOLIO ACTION PLAN ---
  const { data: planData, error: planErr } = await supabase
    .from("portfolio_action_plans")
    .select("content")
    .eq("user_id", userId)
    .single();

  if (!planErr && planData?.content !== undefined && planData.content !== null) {
    store.setState({ portfolioActionPlan: planData.content as string });
  }

  store.getState().setLastEquitySyncedAt(new Date().toISOString());
}

async function seedHoldings(userId: string) {
  const items = useInvestmentsStore.getState().holdings;
  if (items.length === 0) return;
  const rows = items.map((h) => ({
    id: h.id, user_id: userId, symbol: h.symbol,
    fund_name: h.name, type: h.type, quantity: h.quantity,
    avg_buy_price: h.avgPrice, current_price: h.currentPrice,
    prev_close: h.prevClose ?? null,
    current_value: h.quantity * h.currentPrice, source: h.source,
    updated_at: new Date().toISOString(),
    folio_number: h.folio || null,
    amc: h.amc || null,
    scheme_code: h.schemeCode || null,
    isin: h.isin || null,
    sip_amount: h.sipAmount || null,
    sip_day: h.sipDay || null,
    allocation_category: h.allocation || null,
  }));
  supabase.from("holdings").upsert(rows, { onConflict: "user_id,symbol" }).then(({ error }) => {
    if (error) console.warn('[EquitySync] seed holdings:', error.message);
  });
}

async function seedGoals(userId: string) {
  const items = useInvestmentsStore.getState().goals;
  if (items.length === 0) return;
  const rows = items.map((g) => ({
    id: g.id, user_id: userId, goal_name: g.name,
    target_amount: g.target, current_progress: g.current,
    target_date: g.dueDate, priority: g.priority,
    updated_at: new Date().toISOString(),
  }));
  supabase.from("investment_goals").upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn('[EquitySync] seed goals:', error.message);
  });
}

export function queueHoldingSync(
  userId: string,
  action: "create" | "update" | "delete",
  holding: Partial<Holding> & { id: string }
) {
  const data: Record<string, unknown> = { id: holding.id, user_id: userId };
  if (holding.symbol !== undefined) data.symbol = holding.symbol;
  if (holding.name !== undefined) data.fund_name = holding.name;
  if (holding.type !== undefined) data.type = holding.type;
  if (holding.quantity !== undefined) data.quantity = holding.quantity;
  if (holding.avgPrice !== undefined) data.avg_buy_price = holding.avgPrice;
  if (holding.currentPrice !== undefined) {
    data.current_price = holding.currentPrice;
    data.current_value = (holding.quantity ?? 0) * holding.currentPrice;
  }
  if (holding.source !== undefined) data.source = holding.source;
  if (holding.folio !== undefined) data.folio_number = holding.folio || null;
  if (holding.amc !== undefined) data.amc = holding.amc || null;
  if (holding.schemeCode !== undefined) data.scheme_code = holding.schemeCode || null;
  if (holding.isin !== undefined) data.isin = holding.isin || null;
  if (holding.sipAmount !== undefined) data.sip_amount = holding.sipAmount || null;
  if (holding.sipDay !== undefined) data.sip_day = holding.sipDay || null;
  if (holding.allocation !== undefined) data.allocation_category = holding.allocation || null;
  data.updated_at = new Date().toISOString();
  enqueue("holdings", action, data).catch((e: Error) =>
    console.warn('[EquitySync] queueHoldingSync failed:', e)
  );
}

export function queueGoalSync(
  userId: string,
  action: "create" | "update" | "delete",
  goal: Partial<InvestmentGoal> & { id: string }
) {
  const data: Record<string, unknown> = { id: goal.id, user_id: userId };
  if (goal.name !== undefined) data.goal_name = goal.name;
  if (goal.target !== undefined) data.target_amount = goal.target;
  if (goal.current !== undefined) data.current_progress = goal.current;
  if (goal.dueDate !== undefined) data.target_date = goal.dueDate;
  if (goal.priority !== undefined) data.priority = goal.priority;
  data.updated_at = new Date().toISOString();
  enqueue("investment_goals", action, data).catch((e: Error) =>
    console.warn('[EquitySync] queueGoalSync failed:', e)
  );
}

export async function syncActionPlan(userId: string, content: string) {
  await supabase
    .from("portfolio_action_plans")
    .upsert({
      user_id: userId,
      content,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

export async function deleteCloudSnapshot(userId: string, date: string) {
  await supabase
    .from("portfolio_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
}
