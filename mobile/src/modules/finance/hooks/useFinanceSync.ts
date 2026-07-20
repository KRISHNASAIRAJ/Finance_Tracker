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
    synced.current = true;
    doFullSync(user.id);
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

    if (data && data.length > 0) {
      table.mergeIntoStore(data as Record<string, unknown>[]);
    } else if (!_hasSeeded) {
      await table.seedSupabase(userId);
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

const TABLE_MAP = [
  {
    supabaseTable: "transactions",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.transactions.map((t: Transaction) => t.id));
      const newTxns = (rows as unknown as Transaction[]).filter((t) => !existingIds.has(t.id));
      if (newTxns.length > 0) {
        store.setState({ transactions: [...newTxns, ...state.transactions] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.transactions as Transaction[];
      if (items.length === 0) return;
      const rows = items.map((t) => ({
        id: t.id, user_id: userId, type: t.type, amount: t.amount,
        currency: t.currency, date: t.date, category: t.category,
        notes: t.notes ?? null, source: t.source,
      }));
      supabase.from("transactions").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed transactions:', error.message);
      });
    },
  },
  {
    supabaseTable: "credit_cards",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.cards.map((c: CreditCard) => c.id));
      const newCards: CreditCard[] = (rows as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
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
        }));
      if (newCards.length > 0) {
        store.setState({ cards: [...newCards, ...state.cards] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.cards as CreditCard[];
      if (items.length === 0) return;
      const rows = items.map((c) => ({
        id: c.id, user_id: userId, name: c.name, network: c.network,
        ending_with: c.endingWith, billing_day: c.billingDay,
        balance: c.balance, due_date: c.dueDate,
        bank: c.bank, card_limit: c.cardLimit,
        current_outstanding: c.currentOutstanding,
        bill_amount: c.billAmount ?? 0, paid_amount: c.paidAmount ?? 0,
      }));
      supabase.from("credit_cards").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed cards:', error.message);
      });
    },
  },
  {
    supabaseTable: "bank_accounts",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.accounts.map((a: BankAccount) => a.id));
      const newAccs = (rows as unknown as BankAccount[]).filter((a) => !existingIds.has(a.id));
      if (newAccs.length > 0) {
        store.setState({ accounts: [...newAccs, ...state.accounts] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.accounts as BankAccount[];
      if (items.length === 0) return;
      const rows = items.map((a) => ({
        id: a.id, user_id: userId, title: a.title, amount: a.amount,
      }));
      supabase.from("bank_accounts").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed accounts:', error.message);
      });
    },
  },
  {
    supabaseTable: "receivables",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.receivables.map((r: Receivable) => r.id));
      const newRecvs: Receivable[] = (rows as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
          id: r.id as string,
          personName: r.person_name as string ?? "",
          amount: r.amount as number ?? 0,
          dueDate: r.due_date as string ?? "",
          note: r.note as string ?? undefined,
          type: (r.type as "lent" | "borrowed") ?? "lent",
        }));
      if (newRecvs.length > 0) {
        store.setState({ receivables: [...newRecvs, ...state.receivables] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.receivables as Receivable[];
      if (items.length === 0) return;
      const rows = items.map((r) => ({
        id: r.id, user_id: userId, person_name: r.personName, amount: r.amount,
        due_date: r.dueDate, note: r.note ?? null, type: r.type,
      }));
      supabase.from("receivables").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed receivables:', error.message);
      });
    },
  },
  {
    supabaseTable: "fixed_expenses",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.fixedExpenses.map((f: FixedExpense) => f.id));
      const newFixes: FixedExpense[] = (rows as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
          id: r.id as string,
          name: r.name as string ?? "",
          amount: r.amount as number ?? 0,
          billingDay: r.billing_day as number ?? 1,
          category: r.category as string ?? "",
          lastPaidMonth: r.last_paid_month as string ?? "",
          dueDate: r.due_date as string ?? "",
        }));
      if (newFixes.length > 0) {
        store.setState({ fixedExpenses: [...newFixes, ...state.fixedExpenses] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.fixedExpenses as FixedExpense[];
      if (items.length === 0) return;
      const rows = items.map((f) => ({
        id: f.id, user_id: userId, name: f.name, amount: f.amount,
        billing_day: f.billingDay, category: f.category,
        last_paid_month: f.lastPaidMonth, due_date: f.dueDate,
      }));
      supabase.from("fixed_expenses").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed fixed_expenses:', error.message);
      });
    },
  },
  {
    supabaseTable: "payzapp_loads",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.payzappLoads.map((l: PayzappLoad) => l.id));
      const newLoads = (rows as unknown as PayzappLoad[]).filter((l) => !existingIds.has(l.id));
      if (newLoads.length > 0) {
        store.setState({ payzappLoads: [...newLoads, ...state.payzappLoads] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.payzappLoads as PayzappLoad[];
      if (items.length === 0) return;
      const rows = items.map((p) => ({
        id: p.id, user_id: userId, amount: p.amount, date: p.date,
      }));
      supabase.from("payzapp_loads").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed payzapp_loads:', error.message);
      });
    },
  },
  {
    supabaseTable: "expected_incomes",
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.expectedIncomes.map((e: ExpectedIncome) => e.id));
      const newItems: ExpectedIncome[] = (rows as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
          id: r.id as string,
          name: r.name as string ?? "",
          amount: r.amount as number ?? 0,
          notes: (r.notes as string) || undefined,
          date: r.date as string ?? "",
        }));
      if (newItems.length > 0) {
        store.setState({ expectedIncomes: [...newItems, ...state.expectedIncomes] });
      }
    },
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const items = state.expectedIncomes as ExpectedIncome[];
      if (items.length === 0) return;
      const rows = items.map((e) => ({
        id: e.id, user_id: userId, name: e.name, amount: e.amount,
        notes: e.notes ?? null, date: e.date,
      }));
      supabase.from("expected_incomes").upsert(rows, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed expected_incomes:', error.message);
      });
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
    seedSupabase(userId: string) {
      const store = getStore();
      const state = store.getState();
      const budget = state.monthlyBudget;
      supabase.from("user_settings").upsert({
        user_id: userId, monthly_budget: budget ?? 0,
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) console.warn('[FinanceSync] seed user_settings:', error.message);
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
