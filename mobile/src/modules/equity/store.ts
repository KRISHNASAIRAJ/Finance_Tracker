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
  updateHolding: (id: string, updates: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;
  addGoal: (goal: Omit<InvestmentGoal, 'id'>) => string;
  updateGoal: (id: string, updates: Partial<InvestmentGoal>) => void;
  deleteGoal: (id: string) => void;
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

export const useInvestmentsStore = create<InvestmentsState>()(
  persist(
    (set, get) => ({
      lastEquitySyncedAt: null,
      setLastEquitySyncedAt: (iso) => set({ lastEquitySyncedAt: iso }),
      holdings: [
        {
          id: uid(),
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd.',
          type: 'equity' as const,
          quantity: 25,
          avgPrice: 245000,
          currentPrice: 268000,
          source: 'manual' as const,
        },
        {
          id: uid(),
          symbol: 'TCS',
          name: 'Tata Consultancy Services',
          type: 'equity' as const,
          quantity: 12,
          avgPrice: 335000,
          currentPrice: 382000,
          source: 'manual' as const,
        },
        {
          id: uid(),
          symbol: 'HDFCBANK',
          name: 'HDFC Bank Limited',
          type: 'equity' as const,
          quantity: 50,
          avgPrice: 151000,
          currentPrice: 164000,
          source: 'manual' as const,
        },
      ],
      goals: [
        {
          id: uid(),
          name: 'Retirement Fund 2045',
          target: 500000000,
          current: 124500000,
          dueDate: new Date('2045-12-31').toISOString(),
          priority: 'medium' as const,
        },
        {
          id: uid(),
          name: 'New Car Down Payment',
          target: 100000000,
          current: 45000000,
          dueDate: new Date('2027-06-30').toISOString(),
          priority: 'high' as const,
        },
      ],
      snapshots: [],
      chatHistory: [
        {
          id: '1',
          sender: 'assistant',
          text: 'Hi Krishna, I am your Meridian Portfolio Assistant. Ask me anything about your current allocations, target rebalancing, or investment goals.',
          date: new Date().toISOString(),
        },
      ],
      addHolding: (holding) => {
        const id = uid();
        set((state) => ({
          holdings: [...state.holdings, { ...holding, id } as Holding],
        }));
        return id;
      },
      updateHolding: (id, updates) => {
        set((state) => ({
          holdings: state.holdings.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        }));
      },
      deleteHolding: (id) => {
        set((state) => ({
          holdings: state.holdings.filter((h) => h.id !== id),
        }));
      },
      addGoal: (goal) => {
        const id = uid();
        set((state) => ({
          goals: [...state.goals, { ...goal, id } as InvestmentGoal],
        }));
        return id;
      },
      updateGoal: (id, updates) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        }));
      },
      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
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
