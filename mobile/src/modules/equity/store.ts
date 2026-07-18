import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number; // paise
  currentPrice: number; // paise
}

export interface InvestmentGoal {
  id: string;
  name: string;
  target: number; // paise
  current: number; // paise
  dueDate: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  date: string;
}

interface InvestmentsState {
  holdings: Holding[];
  goals: InvestmentGoal[];
  chatHistory: ChatMessage[];
  addHolding: (holding: Holding) => void;
  updateHoldingPrice: (symbol: string, newPriceInPaise: number) => void;
  addGoal: (goal: Omit<InvestmentGoal, 'id'>) => void;
  updateGoalProgress: (id: string, currentInPaise: number) => void;
  addChatMessage: (sender: 'user' | 'assistant', text: string) => void;
  clearChatHistory: () => void;
  getPortfolioValue: () => number;
}

export const useInvestmentsStore = create<InvestmentsState>()(
  persist(
    (set, get) => ({
      holdings: [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd.',
          quantity: 25,
          avgPrice: 245000, // ₹2,450.00
          currentPrice: 268000, // ₹2,680.00
        },
        {
          symbol: 'TCS',
          name: 'Tata Consultancy Services',
          quantity: 12,
          avgPrice: 335000, // ₹3,350.00
          currentPrice: 382000, // ₹3,820.00
        },
        {
          symbol: 'HDFCBANK',
          name: 'HDFC Bank Limited',
          quantity: 50,
          avgPrice: 151000, // ₹1,510.00
          currentPrice: 164000, // ₹1,640.00
        },
      ],
      goals: [
        {
          id: '1',
          name: 'Retirement Fund 2045',
          target: 500000000, // ₹50L
          current: 124500000, // ₹12.45L
          dueDate: new Date('2045-12-31').toISOString(),
        },
        {
          id: '2',
          name: 'New Car Down Payment',
          target: 100000000, // ₹10L
          current: 45000000, // ₹4.5L
          dueDate: new Date('2027-06-30').toISOString(),
        },
      ],
      chatHistory: [
        {
          id: '1',
          sender: 'assistant',
          text: 'Hi Krishna, I am your Meridian Portfolio Assistant. Ask me anything about your current allocations, target rebalancing, or investment goals.',
          date: new Date().toISOString(),
        },
      ],
      addHolding: (holding) => {
        set((state) => ({
          holdings: [...state.holdings, holding],
        }));
      },
      updateHoldingPrice: (symbol, newPrice) => {
        set((state) => ({
          holdings: state.holdings.map((h) => (h.symbol === symbol ? { ...h, currentPrice: newPrice } : h)),
        }));
      },
      addGoal: (goal) => {
        const newGoal: InvestmentGoal = {
          ...goal,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          goals: [...state.goals, newGoal],
        }));
      },
      updateGoalProgress: (id, currentVal) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, current: currentVal } : g)),
        }));
      },
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
