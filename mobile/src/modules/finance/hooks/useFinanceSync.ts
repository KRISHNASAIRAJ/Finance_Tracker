import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import { enqueue } from "../../../services/syncQueue";
import type {
  Transaction,
  CreditCard,
  Receivable,
  BankAccount,
  FixedExpense,
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
    doPull(setState, user.id);
  }, [user]);

  return state;
}

export async function syncNow(userId: string): Promise<SyncState> {
  const state: SyncState = { loading: true, error: null, lastSyncAt: null };
  await doPull(
    (s) => Object.assign(state, s),
    userId
  );
  return state;
}

async function doPull(
  setState: (s: Partial<SyncState>) => void,
  userId: string
) {
  for (const table of TABLE_MAP) {
    const { data, error } = await supabase
      .from(table.supabaseTable)
      .select("*")
      .eq("user_id", userId);

    if (error) {
      setState({ loading: false, error: `${table.supabaseTable}: ${error.message}`, lastSyncAt: null });
      return;
    }

    if (data && data.length > 0) {
      table.mergeIntoStore(data as Record<string, unknown>[]);
    } else if (!_hasSeeded) {
      await table.seedSupabase(userId);
    }
  }

  _hasSeeded = true;
  const now = new Date().toISOString();
  const storeModule = require("../store");
  storeModule.useFinanceStore.getState().setLastSyncedAt(now);
  setState({ loading: false, error: null, lastSyncAt: new Date() });
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
      supabase.from("transactions").upsert(rows, { onConflict: "id" }).then(() => {});
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
      }));
      supabase.from("credit_cards").upsert(rows, { onConflict: "id" }).then(() => {});
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
      supabase.from("bank_accounts").upsert(rows, { onConflict: "id" }).then(() => {});
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
      supabase.from("receivables").upsert(rows, { onConflict: "id" }).then(() => {});
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
      supabase.from("fixed_expenses").upsert(rows, { onConflict: "id" }).then(() => {});
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
      supabase.from("payzapp_loads").upsert(rows, { onConflict: "id" }).then(() => {});
    },
  },
];

export { TABLE_MAP as _internal };

export function queueTransactionSync(
  userId: string,
  action: "create" | "update" | "delete",
  data: Record<string, unknown>
) {
  enqueue("transactions", action, { ...data, user_id: userId });
}

export function queueCardSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("credit_cards", action, { ...data, user_id: userId });
}

export function queueBankAccountSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("bank_accounts", action, { ...data, user_id: userId });
}

export function queueFixedExpenseSync(
  userId: string,
  action: "update",
  data: Record<string, unknown>
) {
  enqueue("fixed_expenses", action, { ...data, user_id: userId });
}
