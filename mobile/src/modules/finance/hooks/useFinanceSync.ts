/**
 * useFinanceSync — syncs the finance store with Supabase via the offline
 * sync queue and seeds demo data when the store is empty.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import { enqueue } from "../../../services/syncQueue";
import type {
  Transaction,
  CreditCard,
  Receivable,
  BankAccount,
  FixedExpense,
  ExpectedIncome,
} from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

interface PayzappLoad {
  id: string;
  amount: number;
  date: string;
}

let _hasSeeded = false;

export function useFinanceSync() {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    loading: true,
    error: null,
    lastSyncAt: null,
  });
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;

    const hydrateAndSync = () => {
      if (synced.current) return;
      synced.current = true;
      doFullSync(user.id);
    };

    // Wait for store hydration before pulling — otherwise a fresh install
    // (empty persisted store) or slow hydration could race the pull and
    // leave the store empty even though cloud has data.
    const storeModule = require("../store");
    const store = storeModule.useFinanceStore;
    if (store.persist && store.persist.hasHydrated && store.persist.hasHydrated()) {
      hydrateAndSync();
    } else if (store.persist && store.persist.onFinishHydration) {
      const unsub = store.persist.onFinishHydration(() => hydrateAndSync());
      return unsub;
    } else {
      hydrateAndSync();
    }
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    _hasSeeded = true;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

export async function syncNow(userId: string): Promise<SyncState> {
  const state: SyncState = { loading: true, error: null, lastSyncAt: null };
  _hasSeeded = true;
  await doPull(userId);
  state.loading = false;
  state.lastSyncAt = new Date();
  return state;
}

async function doFullSync(userId: string) {
  try {
    const { processSyncQueue } = require("../../../services/syncQueue");
    await processSyncQueue();
  } catch (_e) { /* sync attempt fails silently — will retry on next CRUD */ }
  await doPull(userId);
  _hasSeeded = true;
}

async function doPull(userId: string) {
  for (const table of TABLE_MAP) {
    const { data, error } = await supabase
      .from(table.supabaseTable)
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.warn('[FinanceSync] doPull error:', table.supabaseTable, error.message);
      continue;
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    if (rows.length > 0) {
      table.mergeIntoStore(rows);
    }

    // Push only rows that are missing in cloud (brand-new offline rows).
    // Existing rows are never overwritten here — edits travel through the
    // never-drop sync queue, and the cloud-wins merge above keeps the app
    // in sync with the cloud.
    if (table.pushMissing) {
      table.pushMissing(userId, rows);
    } else {
      pushMissingRows(table, userId, rows);
    }
  }

  const now = new Date().toISOString();
  const storeModule = require("../store");
  storeModule.useFinanceStore.getState().setLastSyncedAt(now);
}

function getStore() {
  const storeModule = require("../store");
  return storeModule.useFinanceStore;
}

interface SyncTable {
  supabaseTable: string;
  /** Cloud-wins merge: existing local rows with same id get REPLACED by
   *  cloud values; brand-new cloud rows get added; local-only rows stay. */
  mergeIntoStore: (rows: Record<string, unknown>[]) => void;
  /** Map local store items to cloud rows. */
  toRows: (userId: string, items: any[]) => Record<string, unknown>[];
  /** Get the local items for this table from the store. */
  getLocalItems: () => any[];
  /** Push local-only rows (ids missing from cloud) to Supabase. */
  pushMissing?: (userId: string, cloudRows: Record<string, unknown>[]) => void;
}

/** Build a cloud-wins merge for any table. fromRow maps a cloud row → local item. */
function makeMerge(
  getLocal: () => any[],
  setLocal: (items: any[]) => void,
  fromRow: (r: Record<string, unknown>) => any
) {
  return (rows: Record<string, unknown>[]) => {
    const local = getLocal();
    const cloudById = new Map(rows.map((r) => [r.id as string, fromRow(r)]));
    // Replace matching local rows with cloud versions, keep local-only rows
    const merged = local.map((item) => cloudById.get(item.id) ?? item);
    // Add brand-new cloud rows
    const localIds = new Set(local.map((item) => item.id));
    for (const [id, item] of cloudById) {
      if (!localIds.has(id)) merged.push(item);
    }
    if (merged.length !== local.length) {
      setLocal(merged);
    }
  };
}

function pushMissingRows(table: SyncTable, userId: string, cloudRows: Record<string, unknown>[]) {
  const local = table.getLocalItems();
  if (local.length === 0) return;
  // Only push rows that do NOT exist in cloud — brand-new offline rows.
  // Edits to existing rows travel through the never-drop sync queue, so
  // stale local data can never overwrite the cloud (cloud is the truth
  // for rows it already has).
  const cloudIds = new Set(cloudRows.map((r) => r.id as string));
  const missing = local.filter((item) => !cloudIds.has(item.id));
  if (missing.length === 0) return;
  const rows = table.toRows(userId, missing);
  supabase.from(table.supabaseTable).upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn(`[FinanceSync] pushMissing ${table.supabaseTable}:`, error.message);
  });
}

const TABLE_MAP: SyncTable[] = [
  {
    supabaseTable: "transactions",
    mergeIntoStore: makeMerge(
      () => getStore().getState().transactions as Transaction[],
      (items) => getStore().setState({ transactions: items }),
      (r) => r as unknown as Transaction
    ),
    getLocalItems: () => getStore().getState().transactions as Transaction[],
    toRows(userId, items) {
      return (items as Transaction[]).map((t) => ({
        id: t.id, user_id: userId, type: t.type, amount: t.amount,
        currency: t.currency, date: t.date, category: t.category,
        notes: t.notes ?? null, source: t.source,
        payment_mode: t.paymentMode ?? null,
        linked_card_id: (t as any).linkedCardId ?? null,
      }));
    },
  },
  {
    supabaseTable: "credit_cards",
    mergeIntoStore: makeMerge(
      () => getStore().getState().cards as CreditCard[],
      (items) => getStore().setState({ cards: items }),
      (r) => ({
        id: r.id as string,
        name: r.name as string,
        network: (r.network as CreditCard["network"]) ?? "VISA",
        endingWith: r.ending_with as string ?? "",
        billingDay: r.billing_day as number ?? 1,
        balance: r.balance as number ?? 0,
        dueDate: r.due_date as string ?? "",
        bank: r.bank as string,
        cardLimit: r.card_limit as number,
        currentOutstanding: r.current_outstanding as number,
        billAmount: r.bill_amount as number ?? 0,
        paidAmount: r.paid_amount as number ?? 0,
        annualCharge: r.annual_charge as number ?? 0,
        annualChargeDate: r.annual_charge_date as string ?? undefined,
        isLtf: r.is_ltf as boolean ?? false,
      })
    ),
    getLocalItems: () => getStore().getState().cards as CreditCard[],
    toRows(userId, items) {
      return (items as CreditCard[]).map((c) => ({
        id: c.id, user_id: userId, name: c.name, network: c.network,
        ending_with: c.endingWith, billing_day: c.billingDay,
        balance: c.balance, due_date: c.dueDate,
        bank: c.bank, card_limit: c.cardLimit,
        current_outstanding: c.currentOutstanding,
        bill_amount: c.billAmount ?? 0, paid_amount: c.paidAmount ?? 0,
        annual_charge: c.annualCharge ?? 0,
        annual_charge_date: c.annualChargeDate ?? null,
        is_ltf: c.isLtf ?? false,
      }));
    },
  },
  {
    supabaseTable: "bank_accounts",
    mergeIntoStore: makeMerge(
      () => getStore().getState().accounts as BankAccount[],
      (items) => getStore().setState({ accounts: items }),
      (r) => r as unknown as BankAccount
    ),
    getLocalItems: () => getStore().getState().accounts as BankAccount[],
    toRows(userId, items) {
      return (items as BankAccount[]).map((a) => ({
        id: a.id, user_id: userId, title: a.title, amount: a.amount,
      }));
    },
  },
  {
    supabaseTable: "receivables",
    mergeIntoStore: makeMerge(
      () => getStore().getState().receivables as Receivable[],
      (items) => getStore().setState({ receivables: items }),
      (r) => ({
        id: r.id as string,
        personName: r.person_name as string ?? "",
        amount: r.amount as number ?? 0,
        paidAmount: (r.paid_amount as number) ?? 0,
        dueDate: r.due_date as string ?? "",
        note: r.note as string ?? undefined,
        type: (r.type as "lent" | "borrowed") ?? "lent",
        status: (r.status as "pending" | "partial" | "paid") ?? "pending",
      })
    ),
    getLocalItems: () => getStore().getState().receivables as Receivable[],
    toRows(userId, items) {
      return (items as Receivable[]).map((r) => ({
        id: r.id, user_id: userId, person_name: r.personName, amount: r.amount,
        due_date: r.dueDate, note: r.note ?? null, type: r.type, status: r.status ?? 'pending',
        paid_amount: r.paidAmount ?? 0,
      }));
    },
  },
  {
    supabaseTable: "fixed_expenses",
    mergeIntoStore: makeMerge(
      () => getStore().getState().fixedExpenses as FixedExpense[],
      (items) => getStore().setState({ fixedExpenses: items }),
      (r) => ({
        id: r.id as string,
        name: r.name as string ?? "",
        amount: r.amount as number ?? 0,
        billingDay: r.billing_day as number ?? 1,
        category: r.category as string ?? "",
        lastPaidMonth: r.last_paid_month as string ?? "",
        dueDate: r.due_date as string ?? "",
      })
    ),
    getLocalItems: () => getStore().getState().fixedExpenses as FixedExpense[],
    toRows(userId, items) {
      return (items as FixedExpense[]).map((f) => ({
        id: f.id, user_id: userId, name: f.name, amount: f.amount,
        billing_day: f.billingDay, category: f.category,
        last_paid_month: f.lastPaidMonth, due_date: f.dueDate,
      }));
    },
  },
  {
    supabaseTable: "payzapp_loads",
    mergeIntoStore: makeMerge(
      () => getStore().getState().payzappLoads as PayzappLoad[],
      (items) => getStore().setState({ payzappLoads: items }),
      (r) => r as unknown as PayzappLoad
    ),
    getLocalItems: () => getStore().getState().payzappLoads as PayzappLoad[],
    toRows(userId, items) {
      return (items as PayzappLoad[]).map((p) => ({
        id: p.id, user_id: userId, amount: p.amount, date: p.date,
      }));
    },
  },
  {
    supabaseTable: "expected_incomes",
    mergeIntoStore: makeMerge(
      () => getStore().getState().expectedIncomes as ExpectedIncome[],
      (items) => getStore().setState({ expectedIncomes: items }),
      (r) => ({
        id: r.id as string,
        name: r.name as string ?? "",
        amount: r.amount as number ?? 0,
        notes: (r.notes as string) || undefined,
        date: r.date as string ?? "",
      })
    ),
    getLocalItems: () => getStore().getState().expectedIncomes as ExpectedIncome[],
    toRows(userId, items) {
      return (items as ExpectedIncome[]).map((e) => ({
        id: e.id, user_id: userId, name: e.name, amount: e.amount,
        notes: e.notes ?? null, date: e.date,
      }));
    },
  },
  {
    supabaseTable: "user_settings",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const row = rows[0] as Record<string, unknown> | undefined;
      if (row && typeof row.monthly_budget === 'number') {
        store.getState().setMonthlyBudget(row.monthly_budget as number);
      }
    },
    getLocalItems: () => [],
    toRows() { return []; },
    pushMissing(userId: string) {
      const store = getStore();
      const budget = store.getState().monthlyBudget;
      supabase.from("user_settings").upsert({
        user_id: userId, monthly_budget: budget ?? 0,
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] pushMissing user_settings:', error.message);
      });
    },
  },
];

export { TABLE_MAP as _internal };

export function queueTransactionSync(
  userId: string,
  action: "create" | "update" | "delete",
  data: Record<string, unknown>
) {
  enqueue("transactions", action, { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueTransactionSync failed:', e)
  );
}

export function queueCardSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("credit_cards", action, { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueCardSync failed:', e)
  );
}

export function queueBankAccountSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("bank_accounts", action, { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueBankAccountSync failed:', e)
  );
}

export function queueFixedExpenseSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("fixed_expenses", action, { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueFixedExpenseSync failed:', e)
  );
}

export function queueExpectedIncomeSync(
  userId: string,
  action: "create" | "update" | "delete",
  data: Record<string, unknown>
) {
  enqueue("expected_incomes", action, { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueExpectedIncomeSync failed:', e)
  );
}

export function queueUserSettingsSync(
  userId: string,
  data: Record<string, unknown>
) {
  enqueue("user_settings", "update", { ...data, user_id: userId }).catch((e: Error) =>
    console.warn('[FinanceSync] queueUserSettingsSync failed:', e)
  );
}
