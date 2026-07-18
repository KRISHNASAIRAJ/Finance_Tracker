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
  source: 'manual' | 'sms_auto' | 'kite_sync';
}

export interface CreditCard {
  id: string;
  name: string;
  network: 'VISA' | 'Mastercard' | 'RuPay' | 'Amex';
  endingWith: string;
  billingDay: number;
  balance: number; // in paise
  dueDate: string; // ISO date string
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

interface FinanceState {
  transactions: Transaction[];
  cards: CreditCard[];
  receivables: Receivable[];
  accounts: BankAccount[];
  fixedExpenses: FixedExpense[];
  isOnboarded: boolean;
  onboardingName: string;
  onboardingGoals: string[];
  onboardingDob: string;
  onboardingGender: string;
  completeOnboarding: (data: { name: string; goals: string[]; dob: string; gender: string }) => void;
  notifications: Array<{ id: string; title: string; body: string; date: string; read: boolean }>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  payzappLoads: Array<{ id: string; amount: number; date: string }>;
  addPayzappLoad: (amount: number) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => string;
  editTransaction: (id: string, updated: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  // Account management
  editAccountBalance: (id: string, amount: number) => void;
  // Lent & Borrow management
  addReceivable: (item: Omit<Receivable, 'id'>) => void;
  editReceivable: (id: string, updated: Partial<Receivable>) => void;
  deleteReceivable: (id: string) => void;
  // Credit card management
  editCard: (id: string, updated: Partial<CreditCard>) => void;
  // Fixed expenses paid rollover
  markFixedExpensePaid: (id: string) => void;
  // Summary calculations
  getTotalBalance: () => number;
  getMonthlyExpenses: () => number;
  getMonthlyIncome: () => number;
}

// Helper to convert Rupees from JSON to Paise integers
const rupeeToPaise = (rupees: number) => Math.round(rupees * 100);

export const getMinBalanceForAccount = (title: string): number => {
  const norm = title.toLowerCase();
  if (norm.includes('hdfc')) return 250000; // ₹2,500
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
      isOnboarded: false,
      onboardingName: '',
      onboardingGoals: [],
      onboardingDob: '',
      onboardingGender: '',
      notifications: [
        {
          id: 'notif-1',
          title: 'Welcome to Meridian',
          body: 'Your personal life tracker is set up and ready. Finance, tasks, and garage loggers are active.',
          date: new Date().toISOString(),
          read: false,
        },
        {
          id: 'notif-2',
          title: 'Fixed Expense Due Soon',
          body: 'House Rent is due in 3 days. Total due: ₹13,500.',
          date: new Date(Date.now() - 3600000).toISOString(),
          read: false,
        },
        {
          id: 'notif-3',
          title: 'Payzapp Wallet Goal',
          body: 'Load ₹40,000 to Payzapp to unlock ₹400 cashback. Current load: ₹0.',
          date: new Date(Date.now() - 7200000).toISOString(),
          read: false,
        }
      ],
      payzappLoads: [],
      transactions: [
        {
          id: 'ex-26',
          type: 'expense',
          amount: rupeeToPaise(40),
          currency: 'INR',
          date: new Date(1784140200000).toISOString(),
          category: 'Food & Dining',
          notes: 'Chapati',
          source: 'manual',
        },
        {
          id: 'ex-25',
          type: 'expense',
          amount: rupeeToPaise(68),
          currency: 'INR',
          date: new Date(1784053800000).toISOString(),
          category: 'Food & Dining',
          notes: 'Big Basket',
          source: 'manual',
        },
        {
          id: 'ex-24',
          type: 'expense',
          amount: rupeeToPaise(60),
          currency: 'INR',
          date: new Date(1784053800000).toISOString(),
          category: 'Other',
          notes: 'KITE',
          source: 'manual',
        },
        {
          id: 'ex-23',
          type: 'expense',
          amount: rupeeToPaise(54),
          currency: 'INR',
          date: new Date(1784053800000).toISOString(),
          category: 'Food & Dining',
          notes: 'Breakfast',
          source: 'manual',
        },
        {
          id: 'ex-22',
          type: 'expense',
          amount: rupeeToPaise(273),
          currency: 'INR',
          date: new Date(1783967400000).toISOString(),
          category: 'Food & Dining',
          notes: 'Blinkit',
          source: 'manual',
        },
        {
          id: 'ex-20',
          type: 'expense',
          amount: rupeeToPaise(150),
          currency: 'INR',
          date: new Date(1783881000000).toISOString(),
          category: 'Food & Dining',
          notes: 'BREAKFAST AND LUNC',
          source: 'manual',
        },
        {
          id: 'ex-19',
          type: 'expense',
          amount: rupeeToPaise(100),
          currency: 'INR',
          date: new Date(1783881000000).toISOString(),
          category: 'Lifestyle',
          notes: 'RAPIDO',
          source: 'manual',
        },
        {
          id: 'ex-18',
          type: 'expense',
          amount: rupeeToPaise(200),
          currency: 'INR',
          date: new Date(1783881000000).toISOString(),
          category: 'Food & Dining',
          notes: 'TIFFIN',
          source: 'manual',
        },
        {
          id: 'ex-17',
          type: 'expense',
          amount: rupeeToPaise(80),
          currency: 'INR',
          date: new Date(1783881000000).toISOString(),
          category: 'Food & Dining',
          notes: 'COCONUT',
          source: 'manual',
        },
        {
          id: 'ex-16',
          type: 'expense',
          amount: rupeeToPaise(100),
          currency: 'INR',
          date: new Date(1783621800000).toISOString(),
          category: 'Food & Dining',
          notes: 'TIFFIN',
          source: 'manual',
        },
        {
          id: 'ex-15',
          type: 'expense',
          amount: rupeeToPaise(70),
          currency: 'INR',
          date: new Date(1783621800000).toISOString(),
          category: 'Other',
          notes: 'HAIRCUT',
          source: 'manual',
        },
        {
          id: 'ex-14',
          type: 'expense',
          amount: rupeeToPaise(90),
          currency: 'INR',
          date: new Date(1783535400000).toISOString(),
          category: 'Food & Dining',
          notes: 'Water Bottle',
          source: 'manual',
        },
        {
          id: 'ex-13',
          type: 'expense',
          amount: rupeeToPaise(122),
          currency: 'INR',
          date: new Date(1783535400000).toISOString(),
          category: 'Lifestyle',
          notes: 'METRO',
          source: 'manual',
        },
        {
          id: 'ex-12',
          type: 'expense',
          amount: rupeeToPaise(130),
          currency: 'INR',
          date: new Date(1783535400000).toISOString(),
          category: 'Lifestyle',
          notes: 'RAPIDO',
          source: 'manual',
        },
        {
          id: 'ex-11',
          type: 'expense',
          amount: rupeeToPaise(636),
          currency: 'INR',
          date: new Date(1783535400000).toISOString(),
          category: 'Food & Dining',
          notes: 'THEOBRAMA SWISS CASTLE',
          source: 'manual',
        },
        {
          id: 'ex-10',
          type: 'expense',
          amount: rupeeToPaise(676),
          currency: 'INR',
          date: new Date(1783449000000).toISOString(),
          category: 'Lifestyle',
          notes: 'BUS TICKET',
          source: 'manual',
        },
        {
          id: 'ex-9',
          type: 'expense',
          amount: rupeeToPaise(306.2),
          currency: 'INR',
          date: new Date(1783449000000).toISOString(),
          category: 'Other',
          notes: 'ITBEES',
          source: 'manual',
        },
        {
          id: 'ex-8',
          type: 'expense',
          amount: rupeeToPaise(200),
          currency: 'INR',
          date: new Date(1783449000000).toISOString(),
          category: 'Other',
          notes: 'Gpay Giftcard',
          source: 'manual',
        },
        {
          id: 'ex-1',
          type: 'expense',
          amount: rupeeToPaise(147),
          currency: 'INR',
          date: new Date(1783276200000).toISOString(),
          category: 'Food & Dining',
          notes: 'CHOLE BHATURE',
          source: 'manual',
        },
        {
          id: 'ex-7',
          type: 'expense',
          amount: rupeeToPaise(954),
          currency: 'INR',
          date: new Date(1783103400000).toISOString(),
          category: 'Lifestyle',
          notes: 'Amazon',
          source: 'manual',
        },
        {
          id: 'ex-6',
          type: 'expense',
          amount: rupeeToPaise(20),
          currency: 'INR',
          date: new Date(1783103400000).toISOString(),
          category: 'Food & Dining',
          notes: 'Water',
          source: 'manual',
        },
        {
          id: 'ex-5',
          type: 'expense',
          amount: rupeeToPaise(349),
          currency: 'INR',
          date: new Date(1783103400000).toISOString(),
          category: 'Food & Dining',
          notes: 'Zepto',
          source: 'manual',
        },
        {
          id: 'ex-4',
          type: 'expense',
          amount: rupeeToPaise(160),
          currency: 'INR',
          date: new Date(1783017000000).toISOString(),
          category: 'Food & Dining',
          notes: 'Grocery',
          source: 'manual',
        },
        {
          id: 'ex-3',
          type: 'expense',
          amount: rupeeToPaise(2000),
          currency: 'INR',
          date: new Date(1782930600000).toISOString(),
          category: 'Lifestyle',
          notes: 'Nykaa',
          source: 'manual',
        },
        {
          id: 'ex-2',
          type: 'expense',
          amount: rupeeToPaise(400),
          currency: 'INR',
          date: new Date(1782844200000).toISOString(),
          category: 'Food & Dining',
          notes: 'Blinkit',
          source: 'manual',
        },
      ],
      cards: [
        {
          id: 'card-1',
          name: 'SBI Cashback',
          network: 'VISA',
          endingWith: '4432',
          billingDay: 25,
          balance: rupeeToPaise(22725),
          dueDate: new Date(1785522600000).toISOString(),
        },
        {
          id: 'card-2',
          name: 'Slice Card',
          network: 'RuPay',
          endingWith: '2804',
          billingDay: 25,
          balance: rupeeToPaise(17534),
          dueDate: new Date(1784917800000).toISOString(),
        },
        {
          id: 'card-3',
          name: 'IDFC Power+',
          network: 'RuPay',
          endingWith: '7309',
          billingDay: 19,
          balance: rupeeToPaise(13294),
          dueDate: new Date(1784485800000).toISOString(),
        },
        {
          id: 'card-4',
          name: 'HSBC Card',
          network: 'RuPay',
          endingWith: '9265',
          billingDay: 7,
          balance: rupeeToPaise(3913),
          dueDate: new Date(1786127400000).toISOString(),
        },
        {
          id: 'card-5',
          name: 'SBI SimplySave',
          network: 'RuPay',
          endingWith: '0058',
          billingDay: 14,
          balance: rupeeToPaise(1845),
          dueDate: new Date(1786645800000).toISOString(),
        },
        {
          id: 'card-6',
          name: 'Amazon Pay ICICI',
          network: 'VISA',
          endingWith: '1002',
          billingDay: 14,
          balance: rupeeToPaise(4215),
          dueDate: new Date(1786559400000).toISOString(),
        },
        {
          id: 'card-7',
          name: 'Cred IndusInd',
          network: 'RuPay',
          endingWith: '7190',
          billingDay: 5,
          balance: rupeeToPaise(1478),
          dueDate: new Date(1785954600000).toISOString(),
        },
      ],
      receivables: [
        {
          id: 'rec-69',
          personName: 'AKS',
          amount: rupeeToPaise(700),
          dueDate: new Date(1784485800000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-48',
          personName: 'DAD',
          amount: rupeeToPaise(9600),
          dueDate: new Date(1784485800000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-49',
          personName: 'AKS',
          amount: rupeeToPaise(6229),
          dueDate: new Date(1784917800000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-67',
          personName: 'HSBC DC',
          amount: rupeeToPaise(2000),
          dueDate: new Date(1785436200000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-66',
          personName: 'MAMAIAH',
          amount: rupeeToPaise(1576),
          dueDate: new Date(1785436200000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-68',
          personName: 'DAD',
          amount: rupeeToPaise(12487),
          dueDate: new Date(1785522600000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-63',
          personName: 'SWEETY',
          amount: rupeeToPaise(840),
          dueDate: new Date(1785522600000).toISOString(),
          note: '',
          type: 'lent',
        },
        {
          id: 'rec-57',
          personName: 'MS',
          amount: rupeeToPaise(2000),
          dueDate: new Date(1785522600000).toISOString(),
          note: '',
          type: 'lent',
        },
      ],
      accounts: [
        { id: 'acc-123', title: 'HDFC Bank', amount: rupeeToPaise(1800) },
        { id: 'acc-122', title: 'AXIS Bank', amount: rupeeToPaise(15624) },
        { id: 'acc-118', title: 'SBI Bank', amount: rupeeToPaise(2100) },
        { id: 'acc-103', title: 'HSBC Bank', amount: rupeeToPaise(0) },
        { id: 'acc-81', title: 'SLICE Account', amount: rupeeToPaise(1) },
        { id: 'acc-79', title: 'BOB Bank', amount: rupeeToPaise(2500) },
      ],
      fixedExpenses: [
        {
          id: 'fix-1',
          name: 'Monthly Rent',
          amount: rupeeToPaise(8000),
          billingDay: 5,
          category: 'Housing',
          lastPaidMonth: '', // e.g. empty means unpaid for July
          dueDate: new Date(1783362600000).toISOString(), // 5 Jul 2026 approx
        },
        {
          id: 'fix-2',
          name: 'SIP Mutual Fund (Parag Parikh)',
          amount: rupeeToPaise(2000),
          billingDay: 27,
          category: 'Investments',
          lastPaidMonth: '',
          dueDate: new Date(1785263400000).toISOString(), // 27 Jul 2026 approx
        },
        {
          id: 'fix-3',
          name: 'SIP Quant Active Fund',
          amount: rupeeToPaise(250),
          billingDay: 7,
          category: 'Investments',
          lastPaidMonth: '',
          dueDate: new Date(1783535400000).toISOString(), // 7 Jul 2026 approx
        },
        {
          id: 'fix-4',
          name: 'SIP Nippon Small Cap',
          amount: rupeeToPaise(250),
          billingDay: 15,
          category: 'Investments',
          lastPaidMonth: '',
          dueDate: new Date(1784226600000).toISOString(), // 15 Jul 2026 approx
        },
      ],
      addTransaction: (tx) => {
        const generatedId = Math.random().toString(36).substring(2, 9);
        const newTransaction: Transaction = {
          ...tx,
          id: generatedId,
          date: new Date().toISOString(),
        };
        set((state) => ({
          transactions: [newTransaction, ...state.transactions],
        }));
        return generatedId;
      },
      editTransaction: (id, updated) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updated } : tx
          ),
        }));
      },
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        }));
      },
      editAccountBalance: (id, amount) => {
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, amount } : acc
          ),
        }));
      },
      addReceivable: (item) => {
        const newItem: Receivable = {
          ...item,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          receivables: [newItem, ...state.receivables],
        }));
      },
      editReceivable: (id, updated) => {
        set((state) => ({
          receivables: state.receivables.map((rec) =>
            rec.id === id ? { ...rec, ...updated } : rec
          ),
        }));
      },
      deleteReceivable: (id) => {
        set((state) => ({
          receivables: state.receivables.filter((rec) => rec.id !== id),
        }));
      },
      markFixedExpensePaid: (id) => {
        const currentExp = get().fixedExpenses.find((f) => f.id === id);
        if (!currentExp) return;

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
          type: 'fixed_expense', // satisfies spine write
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
          // Also dynamically add a notification if they hit the target!
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
      },
      editCard: (id, updated) => {
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? { ...c, ...updated } : c)),
        }));
      },
      getTotalBalance: () => {
        return get().accounts.reduce((acc, account) => acc + account.amount, 0);
      },
      getMonthlyExpenses: () => {
        const txs = get().transactions;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        return txs
          .filter(
            (tx) =>
              new Date(tx.date) >= startOfMonth &&
              (tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service')
          )
          .reduce((acc, tx) => acc + tx.amount, 0);
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
    }),
    {
      name: 'meridian-finance-storage-v11', // v11: added onboarding, notifications, payzapp
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
