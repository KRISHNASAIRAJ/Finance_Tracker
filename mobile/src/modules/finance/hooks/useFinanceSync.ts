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

    const rows = (data ?? []) as Record<string, unknown>[];

    if (rows.length > 0) {
      table.mergeIntoStore(rows);
    }

    // ALWAYS push local-only rows to cloud (true bidirectional sync).
    // Previously local rows were only seeded when the cloud table was
    // completely empty — once cloud had any rows, new local data never
    // reached Supabase. pushMissing fixes that without overwriting
    // cloud rows (by id) and without resurrecting deleted rows.
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
  mergeIntoStore: (rows: Record<string, unknown>[]) => void;
  /** Map local store items to cloud rows. */
  toRows: (userId: string, items: any[]) => Record<string, unknown>[];
  /** Get the local items for this table from the store. */
  getLocalItems: () => any[];
  /** Push local-only rows (ids missing from cloud) to Supabase. */
  pushMissing?: (userId: string, cloudRows: Record<string, unknown>[]) => void;
}

function pushMissingRows(table: SyncTable, userId: string, _cloudRows: Record<string, unknown>[]) {
  const local = table.getLocalItems();
  if (local.length === 0) return;
  // Push ALL local rows (upsert by id) — the phone is the source of truth.
  // This ensures edits (balances, paid amounts, bill payments) reach the
  // cloud too, not just brand-new rows.
  const rows = table.toRows(userId, local);
  supabase.from(table.supabaseTable).upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn(`[FinanceSync] pushLocal ${table.supabaseTable}:`, error.message);
  });
}

const TABLE_MAP: SyncTable[] = [
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
          annualCharge: r.annual_charge as number ?? 0,
          annualChargeDate: r.annual_charge_date as string ?? undefined,
          isLtf: r.is_ltf as boolean ?? false,
        }));
      if (newCards.length > 0) {
        store.setState({ cards: [...newCards, ...state.cards] });
      }
    },
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
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.accounts.map((a: BankAccount) => a.id));
      const newAccs = (rows as unknown as BankAccount[]).filter((a) => !existingIds.has(a.id));
      if (newAccs.length > 0) {
        store.setState({ accounts: [...newAccs, ...state.accounts] });
      }
    },
    getLocalItems: () => getStore().getState().accounts as BankAccount[],
    toRows(userId, items) {
      return (items as BankAccount[]).map((a) => ({
        id: a.id, user_id: userId, title: a.title, amount: a.amount,
      }));
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
          paidAmount: (r.paid_amount as number) ?? 0,
          dueDate: r.due_date as string ?? "",
          note: r.note as string ?? undefined,
          type: (r.type as "lent" | "borrowed") ?? "lent",
          status: (r.status as "pending" | "partial" | "paid") ?? "pending",
        }));
      if (newRecvs.length > 0) {
        store.setState({ receivables: [...newRecvs, ...state.receivables] });
      }
    },
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
    mergeIntoStore(rows: Record<string, unknown>[]) {
      const store = getStore();
      const state = store.getState();
      const existingIds = new Set(state.payzappLoads.map((l: PayzappLoad) => l.id));
      const newLoads = (rows as unknown as PayzappLoad[]).filter((l) => !existingIds.has(l.id));
      if (newLoads.length > 0) {
        store.setState({ payzappLoads: [...newLoads, ...state.payzappLoads] });
      }
    },
    getLocalItems: () => getStore().getState().payzappLoads as PayzappLoad[],
    toRows(userId, items) {
      return (items as PayzappLoad[]).map((p) => ({
        id: p.id, user_id: userId, amount: p.amount, date: p.date,
      }));
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
