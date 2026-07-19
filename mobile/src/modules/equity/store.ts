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

interface InvestmentsState {
  lastEquitySyncedAt: string | null;
  setLastEquitySyncedAt: (iso: string) => void;
  holdings: Holding[];
  goals: InvestmentGoal[];
  snapshots: PortfolioSnapshot[];
  chatHistory: ChatMessage[];
  addHolding: (holding: Omit<Holding, 'id'>) => string;
  updateHolding: (id: string, updates: Partial<Holding>, userId?: string) => void;
  deleteHolding: (id: string, userId?: string) => void;
  addGoal: (goal: Omit<InvestmentGoal, 'id'>) => string;
  updateGoal: (id: string, updates: Partial<InvestmentGoal>, userId?: string) => void;
  deleteGoal: (id: string, userId?: string) => void;
  setSnapshots: (snapshots: PortfolioSnapshot[]) => void;
  addChatMessage: (sender: 'user' | 'assistant', text: string) => void;
  clearChatHistory: () => void;
  getPortfolioValue: () => number;
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
        if (userId) {
          try {
            const { enqueue } = require('../../services/syncQueue');
            const holding = get().holdings.find((h) => h.id === id);
            if (holding) {
              const data: Record<string, unknown> = { id, user_id: userId };
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
        }
      },
      deleteHolding: (id, userId) => {
        set((state) => ({
          holdings: state.holdings.filter((h) => h.id !== id),
        }));
        if (userId) {
          try {
            const { enqueue } = require('../../services/syncQueue');
            enqFlush('holdings', 'delete', { id, user_id: userId });
          } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
        }
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
        if (userId) {
          try {
            const { enqueue } = require('../../services/syncQueue');
            const goal = get().goals.find((g) => g.id === id);
            if (goal) {
              const data: Record<string, unknown> = { id, user_id: userId, goal_name: goal.name, target_amount: goal.target, current_progress: goal.current, target_date: goal.dueDate, priority: goal.priority, updated_at: new Date().toISOString() };
              enqFlush('investment_goals', 'update', data);
            }
          } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
        }
      },
      deleteGoal: (id, userId) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        if (userId) {
          try {
            const { enqueue } = require('../../services/syncQueue');
            enqFlush('investment_goals', 'delete', { id, user_id: userId });
          } catch (e) { console.warn('[EquityStore] sync enqueue failed:', e); }
        }
      },
      setSnapshots: (snapshots) => set({ snapshots }),
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
        return get().holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
      },
    }),
    {
      name: 'meridian-investments-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
