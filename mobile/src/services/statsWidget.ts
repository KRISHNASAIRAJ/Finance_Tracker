/**
 * statsWidget — computes the stats shown on the Android home-screen widget
 * and pushes them to the native StatsWidgetBridge (SharedPreferences-backed,
 * same pattern as bedtimeWidget).
 *
 * The widget is a 2x2 carousel: six stat cards (monthly spend, CC bills,
 * bank balance, net lent/debit, tasks left, net worth) auto-advance every
 * 3 seconds with a fade; tapping a card deep-links to that screen.
 *
 * Degrades gracefully (no-ops) on iOS / Expo Go where the module is absent.
 */
import { NativeModules, Platform } from 'react-native';
import {
  useFinanceStore,
  istDateKey,
  type Transaction,
  type CreditCard,
  type BankAccount,
  type Receivable,
} from '../modules/finance/store';
import { useTasksStore, type Task } from '../modules/tasks/store';
import { useInvestmentsStore } from '../modules/equity/store';
import { useGarageStore, type FuelFill } from '../modules/garage/store';

const StatsWidgetModule = NativeModules.StatsWidgetBridge as
  | { setStats: (json: string) => Promise<void> }
  | undefined;

export interface WidgetStats {
  /** IST day key the stats are for, YYYY-MM-DD */
  dayKey: string;
  /** IST month key for the monthly spend roll-up, YYYY-MM */
  monthKey: string;
  /** Money spent this month across outflow types, in paise */
  monthlySpendPaise: number;
  /** Total card bills due (statement amount, else outstanding), in paise */
  ccBillsPaise: number;
  /** Sum of all bank account balances, in paise */
  bankBalancePaise: number;
  /** Net lent (positive) or net borrowed (negative), in paise */
  netLentPaise: number;
  /** Incomplete tasks due today or overdue */
  tasksLeft: number;
  /** Holdings + FDs − loans, in paise */
  netWorthPaise: number;
}

/**
 * Categories the Monthly Spend screen excludes from "spend" (rent, SIPs,
 * investments, wallet loads) — the widget must use the exact same rule so
 * the number on the home screen matches the in-app screen.
 */
const SPEND_EXCLUDED_CATEGORIES = [
  'Rent',
  'SIP',
  'Investments',
  'Housing',
  'Wallet Loads',
  'Wallet Load',
];

/** IST month key (YYYY-MM) — safe from any runtime timezone. */
export function istMonthKey(d: Date = new Date()): string {
  return istDateKey(d).slice(0, 7);
}

export function computeWidgetStats(input: {
  dayKey: string;
  monthKey: string;
  transactions: Transaction[];
  cards: Pick<CreditCard, 'balance' | 'billAmount' | 'currentOutstanding'>[];
  accounts: Pick<BankAccount, 'amount'>[];
  receivables: Pick<Receivable, 'type' | 'amount' | 'paidAmount'>[];
  tasks: Task[];
  netWorthPaise: number;
  /** Garage fuel fills — fuel is counted from here, not from transactions */
  garageFills?: Pick<FuelFill, 'date' | 'amount'>[];
  /** Fixed expense names are excluded from "spend" (they are shown separately) */
  fixedExpenseNames?: string[];
  /** "Now" — injectable so the month window can be tested */
  now?: Date;
}): WidgetStats {
  const {
    dayKey,
    monthKey,
    transactions,
    cards,
    accounts,
    receivables,
    tasks,
    netWorthPaise,
    garageFills = [],
    fixedExpenseNames = [],
    now = new Date(),
  } = input;

  // Monthly spend — mirrors MonthlySpendScreen exactly: transactions of type
  // expense/vehicle_service in the current month, minus rent/SIP/investment
  // categories and fixed expenses, plus this month's garage fuel fills.
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const excludedCategories = [...SPEND_EXCLUDED_CATEGORIES, ...fixedExpenseNames];
  const monthlySpendPaise =
    transactions
      .filter((tx) => {
        const d = tx.date ? new Date(tx.date) : null;
        return !!d && !Number.isNaN(d.getTime()) && d >= startOfMonth;
      })
      .filter((tx) => tx.type !== 'fixed_expense')
      .filter((tx) => tx.type !== 'fuel_purchase')
      .filter((tx) => !excludedCategories.some((c) => c.toLowerCase() === (tx.category || '').toLowerCase()))
      .filter((tx) => tx.type === 'expense' || tx.type === 'vehicle_service')
      .reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0) +
    garageFills
      .filter((f) => {
        const d = f.date ? new Date(f.date) : null;
        return !!d && !Number.isNaN(d.getTime()) && d >= startOfMonth;
      })
      .reduce((sum, f) => sum + (Number.isFinite(f.amount) ? f.amount : 0), 0);

  const ccBillsPaise = cards.reduce((sum, c) => {
    const bill = Number(c.billAmount ?? 0);
    if (Number.isFinite(bill) && bill > 0) return sum + bill;
    const outstanding = Number(c.currentOutstanding ?? c.balance ?? 0);
    return sum + (Number.isFinite(outstanding) ? outstanding : 0);
  }, 0);

  const bankBalancePaise = accounts.reduce(
    (sum, a) => sum + (Number.isFinite(a.amount) ? a.amount : 0),
    0
  );

  let netLentPaise = 0;
  for (const r of receivables) {
    const amount = Number(r.amount ?? 0);
    const paid = Number(r.paidAmount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const outstanding = amount - (Number.isFinite(paid) ? paid : 0);
    netLentPaise += r.type === 'lent' ? outstanding : -outstanding;
  }

  const tasksLeft = tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    return istDateKey(d) <= dayKey;
  }).length;

  return {
    dayKey,
    monthKey,
    monthlySpendPaise,
    ccBillsPaise,
    bankBalancePaise,
    netLentPaise,
    tasksLeft,
    netWorthPaise: Number.isFinite(netWorthPaise) ? netWorthPaise : 0,
  };
}

/** Read the live stores and compute the current widget snapshot. */
export function readWidgetStats(): WidgetStats {
  const f = useFinanceStore.getState();
  const t = useTasksStore.getState();
  const inv = useInvestmentsStore.getState();
  const g = useGarageStore.getState();
  return computeWidgetStats({
    dayKey: istDateKey(),
    monthKey: istMonthKey(),
    transactions: f.transactions,
    cards: f.cards,
    accounts: f.accounts,
    receivables: f.receivables,
    tasks: t.tasks,
    netWorthPaise: inv.getNetWorth(),
    garageFills: g.fills,
    fixedExpenseNames: f.fixedExpenses.map((fx) => fx.name),
  });
}

export function isStatsWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!StatsWidgetModule;
}

/** Push the snapshot to the native widget. Never throws. */
export async function pushStatsWidget(stats?: WidgetStats): Promise<void> {
  if (!isStatsWidgetAvailable()) return;
  try {
    await StatsWidgetModule!.setStats(JSON.stringify(stats ?? readWidgetStats()));
  } catch {
    /* best-effort */
  }
}
