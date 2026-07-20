import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'credit_card_bill' | 'lent' | 'borrowed' | 'fixed_expense' | 'fuel_purchase' | 'vehicle_service' | 'portfolio_buy' | 'portfolio_sell';
  amount: number; // in paise
  currency: string;
  date: string; // ISO string
  category: string;
  notes?: string;
  source: 'manual' | 'kite_sync';
}

export interface CreditCard {
  id: string;
  name: string;
  network: 'VISA' | 'Mastercard' | 'RuPay' | 'Amex';
  endingWith: string;
  billingDay: number;
  balance: number; // in paise
  dueDate: string; // ISO date string
  bank?: string;
  cardLimit?: number; // in paise
  currentOutstanding?: number; // in paise
  billAmount?: number; // current bill statement amount (paise)
  paidAmount?: number; // amount paid toward this bill (paise)
}

export interface Receivable {
  id: string;
  personName: string;
  amount: number; // in paise
  dueDate: string; // ISO date string
  note?: string;
  type: 'lent' | 'borrowed';
}

export interface BankAccount {
  id: string;
  title: string;
  amount: number; // in paise
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number; // in paise
  billingDay: number;
  category: string;
  lastPaidMonth: string; // e.g. "2026-06" or "2026-07"
  dueDate: string; // ISO date string
}

export interface ExpectedIncome {
  id: string;
  name: string;
  amount: number; // in paise
  notes?: string;
  date: string; // ISO date string
}

interface FinanceState {
  transactions: Transaction[];
  cards: CreditCard[];
  receivables: Receivable[];
  accounts: BankAccount[];
  fixedExpenses: FixedExpense[];
  lastSyncedAt: string | null;
  isOnboarded: boolean;
  onboardingName: string;
  onboardingGoals: string[];
  onboardingDob: string;
  onboardingGender: string;
  completeOnboarding: (data: { name: string; goals: string[]; dob: string; gender: string }) => void;
  updateOnboardingName: (name: string) => void;
  notifications: Array<{ id: string; title: string; body: string; date: string; read: boolean }>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  payzappLoads: Array<{ id: string; amount: number; date: string }>;
  addPayzappLoad: (amount: number) => void;
  editPayzappLoad: (id: string, amount: number) => void;
  resetPayzappLoadsIfNewMonth: () => void;
  expectedIncomes: ExpectedIncome[];
  addExpectedIncome: (item: Omit<ExpectedIncome, 'id'>, userId?: string) => void;
  editExpectedIncome: (id: string, updated: Partial<ExpectedIncome>, userId?: string) => void;
  deleteExpectedIncome: (id: string, userId?: string) => void;
  monthlyBudget: number; // in rupees (not paise)
  setMonthlyBudget: (amount: number, userId?: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'> & { date?: string }, userId?: string) => string;
  editTransaction: (id: string, updated: Partial<Transaction>, userId?: string) => void;
  deleteTransaction: (id: string, userId?: string) => void;
  editAccountBalance: (id: string, amount: number, userId?: string) => void;
  addReceivable: (item: Omit<Receivable, 'id'>, userId?: string) => void;
  editReceivable: (id: string, updated: Partial<Receivable>, userId?: string) => void;
  deleteReceivable: (id: string, userId?: string) => void;
  editCard: (id: string, updated: Partial<CreditCard>, userId?: string) => void;
  addCard: (card: Omit<CreditCard, 'id'>, userId?: string) => void;
  deleteCard: (id: string, userId?: string) => void;
  markFixedExpensePaid: (id: string, userId?: string) => void;
  unmarkFixedExpensePaid: (id: string, userId?: string) => void;
  getTotalBalance: () => number;
  getMonthlyExpenses: () => number;
  getMonthlyIncome: () => number;
  setLastSyncedAt: (ts: string) => void;
}

// Helper to convert Rupees from JSON to Paise integers
const rupeeToPaise = (rupees: number) => Math.round(rupees * 100);

function enqFlush(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue, processSyncQueue } = require('../../services/syncQueue');
    enqueue(entity, action, data).finally(() => {
      processSyncQueue().catch((e: Error) => console.warn('[FinanceStore] flush failed:', e));
    }).catch((e: Error) => console.warn('[FinanceStore] enqueue failed:', e));
  } catch (e) { console.warn('[FinanceStore] enqFlush failed:', e); }
}

export const getMinBalanceForAccount = (title: string): number => {
  const norm = title.toLowerCase();
  if (norm.includes('hdfc')) return 260000; // ₹2,600
  if (norm.includes('axis')) return 1000000; // ₹10,000
  if (norm.includes('sbi')) return 210000; // ₹2,100
  if (norm.includes('hsbc')) return 0;
  if (norm.includes('slice')) return 0;
  if (norm.includes('bob')) return 250000; // ₹2,500
  return 0;
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      lastSyncedAt: null,
      isOnboarded: false,
      onboardingName: '',
      onboardingGoals: [],
      onboardingDob: '',
      onboardingGender: '',
      notifications: [],
      payzappLoads: [],
      expectedIncomes: [],
      monthlyBudget: 0,
      transactions: [],
      cards: [],
      receivables: [],
      accounts: [],
      fixedExpenses: [],
      addTransaction: (tx, userId) => {
        const generatedId = Math.random().toString(36).substring(2, 9);
        const { date: txDate, ...rest } = tx as { date?: string } & typeof tx;
        const newTransaction: Transaction = {
          ...rest,
          id: generatedId,
          date: txDate || new Date().toISOString(),
        } as Transaction;
        set((state) => ({
          transactions: [newTransaction, ...state.transactions],
        }));
        if (userId) {
          enqFlush("transactions", "create", { ...newTransaction, user_id: userId });
        }
        return generatedId;
      },
      editTransaction: (id, updated, userId) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updated } : tx
          ),
        }));
        if (userId) {
          enqFlush("transactions", "update", { id, ...updated, user_id: userId });
        }
      },
      deleteTransaction: (id, userId) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        }));
        if (userId) {
          enqFlush("transactions", "delete", { id, user_id: userId });
        }
      },
      editAccountBalance: (id, amount, userId) => {
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, amount } : acc
          ),
        }));
        if (userId) {
          enqFlush("bank_accounts", "update", { id, amount, user_id: userId });
        }
      },
      addReceivable: (item, userId) => {
        const newItem: Receivable = {
          ...item,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          receivables: [newItem, ...state.receivables],
        }));
        if (userId) {
          try {
            enqFlush("receivables", "create", {
              id: newItem.id, person_name: newItem.personName,
              amount: newItem.amount, due_date: newItem.dueDate,
              note: newItem.note ?? null, type: newItem.type, user_id: userId,
            });
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      editReceivable: (id, updated, userId) => {
        set((state) => ({
          receivables: state.receivables.map((rec) =>
            rec.id === id ? { ...rec, ...updated } : rec
          ),
        }));
        if (userId) {
          try {
const payload: Record<string, unknown> = { id, user_id: userId };
            if (updated.personName !== undefined) payload.person_name = updated.personName;
            if (updated.amount !== undefined) payload.amount = updated.amount;
            if (updated.dueDate !== undefined) payload.due_date = updated.dueDate;
            if (updated.note !== undefined) payload.note = updated.note;
            if (updated.type !== undefined) payload.type = updated.type;
            enqFlush("receivables", "update", payload);
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      deleteReceivable: (id, userId) => {
        set((state) => ({
          receivables: state.receivables.filter((rec) => rec.id !== id),
        }));
        if (userId) {
          enqFlush("receivables", "delete", { id, user_id: userId });
        }
      },
      markFixedExpensePaid: (id, userId) => {
        const currentExp = get().fixedExpenses.find((f) => f.id === id);
        if (!currentExp) return;

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (currentExp.lastPaidMonth === currentMonthStr) return; // already paid this month

        const currentDueDate = new Date(currentExp.dueDate);
        const nextDueDate = new Date(
          currentDueDate.getFullYear(),
          currentDueDate.getMonth() + 1,
          currentDueDate.getDate()
        );

        const generatedTxId = Math.random().toString(36).substring(2, 9);
        const newTransaction: Transaction = {
          id: generatedTxId,
          type: 'fixed_expense',
          amount: currentExp.amount,
          currency: 'INR',
          date: new Date().toISOString(),
          category: currentExp.category,
          notes: `${currentExp.name} — Paid`,
          source: 'manual',
        };

        set((state) => ({
          transactions: [newTransaction, ...state.transactions],
          fixedExpenses: state.fixedExpenses.map((f) =>
            f.id === id
              ? {
                  ...f,
                  lastPaidMonth: currentMonthStr,
                  dueDate: nextDueDate.toISOString(),
                }
              : f
          ),
        }));

        // Queue cloud sync
        if (userId) {
          try {
            enqFlush('transactions', 'create', { ...newTransaction, user_id: userId });
            enqFlush('fixed_expenses', 'update', {
              id, user_id: userId, last_paid_month: currentMonthStr,
              due_date: nextDueDate.toISOString(),
            });
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      completeOnboarding: (data) => {
        set({
          isOnboarded: true,
          onboardingName: data.name,
          onboardingGoals: data.goals,
          onboardingDob: data.dob,
          onboardingGender: data.gender,
        });
      },
      updateOnboardingName: (name) => {
        set({ onboardingName: name });
      },
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },
      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      addPayzappLoad: (amount) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newLoad = {
          id,
          amount,
          date: new Date().toISOString(),
        };

        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'fixed_expense',
          amount,
          currency: 'INR',
          date: new Date().toISOString(),
          category: 'wallet loads',
          notes: `Payzapp Wallet Load`,
          source: 'manual',
        };

        set((state) => ({
          payzappLoads: [newLoad, ...state.payzappLoads],
          transactions: [newTx, ...state.transactions],
          notifications: [
            {
              id: Math.random().toString(36).substring(2, 9),
              title: 'Payzapp Load Updated',
              body: `Successfully loaded ₹${(amount / 100).toLocaleString('en-IN')}. Current total this month: ₹${(([newLoad, ...state.payzappLoads].reduce((sum, item) => sum + item.amount, 0)) / 100).toLocaleString('en-IN')}/₹40,000`,
              date: new Date().toISOString(),
              read: false,
            },
            ...state.notifications,
          ]
        }));

        try {
          const { user } = require('../../services/AuthProvider');
          if (user) {
            enqFlush("payzapp_loads", "create", { id, user_id: user.id, amount, date: newLoad.date });
          }
      } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
      },
      editPayzappLoad: (id, amount) => {
        set((state) => ({
          payzappLoads: state.payzappLoads.map((load) =>
            load.id === id ? { ...load, amount } : load
          ),
        }));
      },
      resetPayzappLoadsIfNewMonth: () => {
        const state = get();
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastLoad = state.payzappLoads[0];
        if (lastLoad) {
          const lastLoadDate = new Date(lastLoad.date);
          const lastLoadMonth = `${lastLoadDate.getFullYear()}-${String(lastLoadDate.getMonth() + 1).padStart(2, '0')}`;
          if (lastLoadMonth !== currentMonth) {
            set({ payzappLoads: [] });
          }
        }
      },
      editCard: (id, updated, userId) => {
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? { ...c, ...updated } : c)),
        }));
        if (userId) {
          try {
const payload: Record<string, unknown> = { id, user_id: userId };
            if (updated.balance !== undefined) payload.balance = updated.balance;
            if (updated.dueDate !== undefined) payload.due_date = updated.dueDate;
            if (updated.name !== undefined) payload.name = updated.name;
            if (updated.endingWith !== undefined) payload.ending_with = updated.endingWith;
            if (updated.billingDay !== undefined) payload.billing_day = updated.billingDay;
            if (updated.billAmount !== undefined) payload.bill_amount = updated.billAmount;
            if (updated.paidAmount !== undefined) payload.paid_amount = updated.paidAmount;
            enqFlush("credit_cards", "update", payload);
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      addCard: (cardData, userId) => {
        const newCard: CreditCard = {
          ...cardData,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({ cards: [...state.cards, newCard] }));
        if (userId) {
          try {
            enqFlush("credit_cards", "create", {
              id: newCard.id,
              user_id: userId,
              name: newCard.name,
              network: newCard.network,
              ending_with: newCard.endingWith,
              billing_day: newCard.billingDay,
              balance: newCard.balance,
              due_date: newCard.dueDate,
              bank: newCard.bank ?? null,
              card_limit: newCard.cardLimit ?? null,
              current_outstanding: newCard.currentOutstanding ?? null,
              bill_amount: newCard.billAmount ?? 0,
              paid_amount: newCard.paidAmount ?? 0,
            });
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      deleteCard: (id, userId) => {
        set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }));
        if (userId) {
          enqFlush("credit_cards", "delete", { id, user_id: userId });
        }
      },
      getTotalBalance: () => {
        return get().accounts.reduce((acc, account) => acc + account.amount, 0);
      },
      getMonthlyExpenses: () => {
        const txs = get().transactions;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const excluded = new Set([
          'Rent', 'SIP', 'Investments', 'Housing', 'Wallet Loads', 'Wallet Load',
          ...get().fixedExpenses.map((f) => f.name.toLowerCase()),
        ]);
        const monthTxs = txs.filter(
          (tx) =>
            new Date(tx.date) >= startOfMonth &&
            (tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service') &&
            tx.type !== 'fixed_expense' &&
            !excluded.has(tx.category.toLowerCase())
        );
        let total = monthTxs.reduce((acc, tx) => acc + tx.amount, 0);

        const fuelTxAmount = monthTxs
          .filter((tx) => tx.type === 'fuel_purchase')
          .reduce((acc, tx) => acc + tx.amount, 0);
        try {
          const { useGarageStore } = require('../../modules/garage/store');
          const fills: Array<{ date: string; amount: number }> = useGarageStore.getState().fills;
          const fuelFillAmount = fills
            .filter((f) => new Date(f.date) >= startOfMonth)
            .reduce((sum, f) => sum + f.amount, 0);
          if (fuelFillAmount > fuelTxAmount) {
            total += fuelFillAmount - fuelTxAmount;
          }
        } catch (e) { console.warn('[FinanceStore] fuel helper failed:', e); }

        return total;
      },
      getMonthlyIncome: () => {
        const txs = get().transactions;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        return txs
          .filter((tx) => new Date(tx.date) >= startOfMonth && tx.type === 'income')
          .reduce((acc, tx) => acc + tx.amount, 0);
      },
      unmarkFixedExpensePaid: (id, userId) => {
        set((state) => ({
          fixedExpenses: state.fixedExpenses.map((f) => {
            if (f.id !== id) return f;
            const currentDueDate = new Date(f.dueDate);
            return {
              ...f,
              lastPaidMonth: '',
              dueDate: new Date(
                currentDueDate.getFullYear(),
                currentDueDate.getMonth() - 1,
                currentDueDate.getDate()
              ).toISOString(),
            };
          }),
        }));
        if (userId) {
          try {
            enqFlush("fixed_expenses", "update", {
              id, user_id: userId, last_paid_month: "", due_date: get().fixedExpenses.find((f: FixedExpense) => f.id === id)?.dueDate ?? "",
            });
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      addExpectedIncome: (item, userId) => {
        const id = `expinc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newItem = { ...item, id };
        set((state) => ({ expectedIncomes: [...state.expectedIncomes, newItem] }));
        if (userId) {
          try {
            enqFlush("expected_incomes", "create", {
              id, user_id: userId, name: newItem.name, amount: newItem.amount,
              notes: newItem.notes ?? null, date: newItem.date,
            });
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      editExpectedIncome: (id, updated, userId) => {
        set((state) => ({
          expectedIncomes: state.expectedIncomes.map((ei) =>
            ei.id === id ? { ...ei, ...updated } : ei
          ),
        }));
        if (userId) {
          try {
            const item = get().expectedIncomes.find((ei) => ei.id === id);
            if (item) {
              enqFlush("expected_incomes", "update", {
                id, user_id: userId, name: item.name, amount: item.amount,
                notes: item.notes ?? null, date: item.date,
              });
            }
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      deleteExpectedIncome: (id, userId) => {
        set((state) => ({ expectedIncomes: state.expectedIncomes.filter((ei) => ei.id !== id) }));
        if (userId) {
          enqFlush("expected_incomes", "delete", { id, user_id: userId });
        }
      },
      setMonthlyBudget: (amount, userId) => {
        set({ monthlyBudget: amount });
        if (userId) {
          try {
            const { supabase } = require("../../services/supabaseClient");
            supabase.from("user_settings").upsert(
              { user_id: userId, monthly_budget: amount },
              { onConflict: "user_id" }
            ).then(() => {});
        } catch (e) { console.warn('[FinanceStore] sync failed:', e); }
        }
      },
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
    }),
    {
      name: 'meridian-finance-storage-v13',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
