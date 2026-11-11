/**
 * Equity module Zustand store — holdings, investment goals and portfolio snapshots
 * with persisted state and sync queue integration.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  type: 'equity' | 'mf' | 'etf' | 'other';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  prevClose?: number;
  source: 'manual' | 'kite_sync';
  folio?: string;
  amc?: string;
  schemeCode?: string;
  isin?: string;
  sipAmount?: number;
  ip?: string;
  sipDay?: number;
  allocation?: string;
}

export interface InvestmentGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  date: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  dayChange: number;
  dayChangePct: number;
  allocation: Record<string, number>;
}

export interface Loan {
  id: string;
  name: string;
  amount: number; // outstanding principal in paise
}

export interface FixedDeposit {
  id: string;
  name: string;
  amount: number; // deposit value in paise
}

interface InvestmentsState {
  lastEquitySyncedAt: string | null;
  setLastEquitySyncedAt: (iso: string) => void;
  holdings: Holding[];
  goals: InvestmentGoal[];
  loans: Loan[];
  fds: FixedDeposit[];
  snapshots: PortfolioSnapshot[];
  chatHistory: ChatMessage[];
  portfolioActionPlan: string;
  setPortfolioActionPlan: (content: string) => void;
  addHolding: (holding: Omit<Holding, 'id'>) => string;
  updateHolding: (id: string, updates: Partial<Holding>, userId?: string) => void;
  deleteHolding: (id: string, userId?: string) => void;
  addGoal: (goal: Omit<InvestmentGoal, 'id'>) => string;
  updateGoal: (id: string, updates: Partial<InvestmentGoal>, userId?: string) => void;
  deleteGoal: (id: string, userId?: string) => void;
  addLoan: (loan: Omit<Loan, 'id'>, userId?: string) => string;
  updateLoan: (id: string, updates: Partial<Loan>, userId?: string) => void;
  /** Add/subtract from a loan's outstanding amount (clamped at 0). */
  adjustLoanAmount: (id: string, deltaPaise: number, userId?: string) => void;
  deleteLoan: (id: string, userId?: string) => void;
  addFD: (fd: Omit<FixedDeposit, 'id'>, userId?: string) => string;
  updateFD: (id: string, updates: Partial<FixedDeposit>, userId?: string) => void;
  deleteFD: (id: string, userId?: string) => void;
  setSnapshots: (snapshots: PortfolioSnapshot[]) => void;
  deleteSnapshot: (date: string) => void;
  addChatMessage: (sender: 'user' | 'assistant', text: string) => void;
  clearChatHistory: () => void;
  getPortfolioValue: () => number;
  getTodayPnL: () => number;
  getTotalLoans: () => number;
  getTotalFDs: () => number;
  getNetWorth: () => number;
}

/** Allocation categories the app understands (mirrored in the web app). */
export const ALLOCATION_CATEGORIES = [
  'Equity',
  'Mutual Funds',
  'ETF',
  'Gold',
  'Realty',
  'Other',
];

/**
 * Effective allocation category for a holding. An explicit category wins
 * (trimmed + validated against the known list); otherwise it falls back to
 * the holding type. Mobile and web must agree on this rule — the allocation
 * donut, the per-holding breakdown and the list tabs all read from here.
 */
export function allocationCategoryOf(h: Pick<Holding, 'type' | 'allocation'>): string {
  const raw = (h.allocation ?? '').trim();
  if (raw) {
    const match = ALLOCATION_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
    if (match) return match;
  }
  if (h.type === 'mf') return 'Mutual Funds';
  if (h.type === 'etf') return 'ETF';
  if (h.type === 'equity') return 'Equity';
  return 'Other';
}

/** Current value of a holding, guarding against junk numbers. */
export function holdingValueOf(h: Pick<Holding, 'quantity' | 'currentPrice'>): number {
  const q = Number(h.quantity);
  const p = Number(h.currentPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

/**
 * Allocation buckets for the donut/legend. Holdings that are worth nothing
 * (sold out, zero quantity, or malformed numbers) are skipped so a stale
 * row can never show up as a phantom "Gold"/"Equity" slice — the same
 * rule the web dashboard uses.
 */
export function allocationBuckets(
  holdings: Pick<Holding, 'type' | 'allocation' | 'quantity' | 'currentPrice'>[]
): { category: string; value: number; pct: number }[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const value = holdingValueOf(h);
    if (value <= 0) continue;
    const cat = allocationCategoryOf(h);
    map.set(cat, (map.get(cat) ?? 0) + value);
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({
      category,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }));
}

function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function enqFlush(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue, processSyncQueue } = require('../../services/syncQueue');
    enqueue(entity, action, data).finally(() => {
      processSyncQueue().catch((e: Error) => console.warn('[EquityStore] flush failed:', e));
    });
  } catch (e) { console.warn('[EquityStore] enqFlush failed:', e); }
}

export const useInvestmentsStore = create<InvestmentsState>()(
  persist(
    (set, get) => ({
      lastEquitySyncedAt: null,
      setLastEquitySyncedAt: (iso) => set({ lastEquitySyncedAt: iso }),
      holdings: [],
      goals: [],
      snapshots: [],
      chatHistory: [],
      portfolioActionPlan: '',
      loans: [],
      fds: [],
      addHolding: (holding) => {
        const id = uid();
        set((state) => ({
          holdings: [...state.holdings, { ...holding, id } as Holding],
        }));
        return id;
      },
      updateHolding: (id, updates, userId) => {
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        }));
        try {
          const holding = get().holdings.find((h) => h.id === id);
          if (holding) {
            const data: Record<string, unknown> = { id, user_id: userId || null };
            if (holding.symbol !== undefined) data.symbol = holding.symbol;
            if (holding.name !== undefined) data.fund_name = holding.name;
            if (holding.type !== undefined) data.type = holding.type;
            if (holding.quantity !== undefined) data.quantity = holding.quantity;
            if (holding.avgPrice !== undefined) data.avg_buy_price = holding.avgPrice;
            if (holding.currentPrice !== undefined) { data.current_price = holding.currentPrice; data.current_value = holding.quantity * holding.currentPrice; }
            if (holding.source !== undefined) data.source = holding.source;
            data.updated_at = new Date().toISOString();
            enqFlush('holdings', 'update', data);
          }
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      deleteHolding: (id, userId) => {
        set((state) => ({
          holdings: state.holdings.filter((h) => h.id !== id),
        }));
        try {
          enqFlush('holdings', 'delete', { id, user_id: userId || null });
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      addGoal: (goal) => {
        const id = uid();
        set((state) => ({
          goals: [...state.goals, { ...goal, id } as InvestmentGoal],
        }));
        return id;
      },
      updateGoal: (id, updates, userId) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        }));
        try {
          const goal = get().goals.find((g) => g.id === id);
          if (goal) {
            const data: Record<string, unknown> = { id, user_id: userId || null, goal_name: goal.name, target_amount: goal.target, current_progress: goal.current, target_date: goal.dueDate, priority: goal.priority, updated_at: new Date().toISOString() };
            enqFlush('investment_goals', 'update', data);
          }
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      deleteGoal: (id, userId) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        try {
          enqFlush('investment_goals', 'delete', { id, user_id: userId || null });
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      addLoan: (loan, userId) => {
        const id = uid();
        set((state) => ({
          loans: [...state.loans, { ...loan, id } as Loan],
        }));
        enqFlush('loans', 'create', {
          id, user_id: userId || null, name: loan.name, amount: loan.amount,
        });
        return id;
      },
      updateLoan: (id, updates, userId) => {
        set((state) => ({
          loans: state.loans.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        }));
        try {
          const loan = get().loans.find((l) => l.id === id);
          if (loan) {
            const data: Record<string, unknown> = { id, user_id: userId || null };
            if (loan.name !== undefined) data.name = loan.name;
            if (loan.amount !== undefined) data.amount = loan.amount;
            data.updated_at = new Date().toISOString();
            enqFlush('loans', 'update', data);
          }
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      adjustLoanAmount: (id, deltaPaise, userId) => {
        const current = get().loans.find((l) => l.id === id);
        if (!current || !Number.isFinite(deltaPaise) || deltaPaise === 0) return;
        const next = Math.max(0, current.amount + Math.round(deltaPaise));
        if (next === current.amount) return;
        get().updateLoan(id, { amount: next }, userId);
      },
      deleteLoan: (id, userId) => {
        set((state) => ({
          loans: state.loans.filter((l) => l.id !== id),
        }));
        enqFlush('loans', 'delete', { id, user_id: userId || null });
      },
      addFD: (fd, userId) => {
        const id = uid();
        set((state) => ({
          fds: [...state.fds, { ...fd, id } as FixedDeposit],
        }));
        enqFlush('fixed_deposits', 'create', {
          id, user_id: userId || null, name: fd.name, amount: fd.amount,
        });
        return id;
      },
      updateFD: (id, updates, userId) => {
        set((state) => ({
          fds: state.fds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        }));
        try {
          const fd = get().fds.find((f) => f.id === id);
          if (fd) {
            const data: Record<string, unknown> = { id, user_id: userId || null };
            if (fd.name !== undefined) data.name = fd.name;
            if (fd.amount !== undefined) data.amount = fd.amount;
            data.updated_at = new Date().toISOString();
            enqFlush('fixed_deposits', 'update', data);
          }
        } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
      },
      deleteFD: (id, userId) => {
        set((state) => ({
          fds: state.fds.filter((f) => f.id !== id),
        }));
        enqFlush('fixed_deposits', 'delete', { id, user_id: userId || null });
      },
      setSnapshots: (snapshots) => set({ snapshots }),
      deleteSnapshot: (date) => set((state) => ({
        snapshots: state.snapshots.filter((s) => s.date !== date),
      })),
      setPortfolioActionPlan: (content) => set({ portfolioActionPlan: content }),
      addChatMessage: (sender, text) => {
        const newMessage: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          sender,
          text,
          date: new Date().toISOString(),
        };
        set((state) => ({
          chatHistory: [...state.chatHistory, newMessage],
        }));
      },
      clearChatHistory: () => {
        set({ chatHistory: [] });
      },
      getPortfolioValue: () => {
        return get().holdings.reduce((sum, h) => {
          const q = Number(h.quantity);
          const p = Number(h.currentPrice);
          if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
          return sum + q * p;
        }, 0);
      },
      getTodayPnL: () => {
        return get().holdings.reduce((sum, h) => {
          if (!h.prevClose || h.prevClose <= 0) return sum;
          const q = Number(h.quantity);
          const p = Number(h.currentPrice);
          const pc = Number(h.prevClose);
          if (!Number.isFinite(q) || !Number.isFinite(p) || !Number.isFinite(pc)) return sum;
          return sum + q * (p - pc);
        }, 0);
      },
      getTotalLoans: () => {
        return get().loans.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
      },
      getTotalFDs: () => {
        return get().fds.reduce((sum, f) => sum + (Number.isFinite(f.amount) ? f.amount : 0), 0);
      },
      getNetWorth: () => {
        return get().holdings.reduce((sum, h) => {
          const q = Number(h.quantity);
          const p = Number(h.currentPrice);
          if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
          return sum + q * p;
        }, 0)
          + get().fds.reduce((sum, f) => sum + (Number.isFinite(f.amount) ? f.amount : 0), 0)
          - get().loans.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
      },
    }),
    {
      name: 'meridian-investments-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
