/**
 * statsWidget — computes the stats shown on the Android home-screen widget and
 * pushes them to the native StatsWidgetBridge (SharedPreferences-backed, the
 * same pattern as the sleep widget bridge).
 *
 * The widget is a 2x2 carousel: five screens (card bills, bank balance, lent,
 * my wealth, tasks) fade through every 3 seconds; tapping it goes to the next
 * screen. Each screen has a grey label, one hero value and three rows.
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
import { useInvestmentsStore, type Holding } from '../modules/equity/store';
import { useGarageStore, type FuelFill } from '../modules/garage/store';

const StatsWidgetModule = NativeModules.StatsWidgetBridge as
  | { setStats: (json: string) => Promise<void> }
  | undefined;

/** One row of a stats screen: a name on the left, a value on the right. */
export interface WidgetRow {
  name: string;
  value: string;
  /** Drawn in red (a late / overdue item). */
  late?: boolean;
  /** Struck through and grey (a finished task). */
  done?: boolean;
}

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
  /** Today's market change (holdings Δ (price − prev close)), in paise */
  dayChangePaise: number;
  /** Today's market change in percent (vs. the previous close value) */
  dayChangePct: number;
  /** Current portfolio value of the holdings, in paise */
  portfolioValuePaise: number;

  // --- the rows of the five screens ---
  /** The card bills: the card, the amount and the due date. */
  cardRows: WidgetRow[];
  /** The bank balances: the bank and the balance. */
  bankRows: WidgetRow[];
  /** The lent money: the person and the amount (the late ones in red). */
  lentRows: WidgetRow[];
  /** The tasks: the name (the finished ones struck through). */
  taskRows: WidgetRow[];
  /** The wealth split: the equity / MF / other share, in percent. */
  wealthSplit: number[];
}

/**
 * Paise → "₹42,300" (or "₹3.8L" from a lakh up) — the screen heroes.
 */
export function formatStatMoney(paise: number): string {
  const rupees = Math.abs(paise || 0) / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

/**
 * Paise → "₹12.4k" / "₹20k" / "₹2.1L" — the compact form the rows use, so a
 * name and a value fit on one line of the 2x2 widget.
 */
export function formatRowMoney(paise: number): string {
  const rupees = Math.abs(paise || 0) / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) {
    const k = (rupees / 1000).toFixed(1).replace(/\.0$/, '');
    return `₹${k}k`;
  }
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

/** "18 Nov" — the short date. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
  dayChangePaise?: number;
  portfolioValuePaise?: number;
  garageFills?: Pick<FuelFill, 'date' | 'amount'>[];
  fixedExpenseNames?: string[];
  /** The card rows: the name, the amount and the due date. */
  cardDetails?: Pick<CreditCard, 'name' | 'balance' | 'billAmount' | 'currentOutstanding' | 'dueDate'>[];
  /** The bank rows: the title and the balance. */
  bankDetails?: Pick<BankAccount, 'title' | 'amount'>[];
  /** The receivables: the person, the amount and the due date. */
  receivableDetails?: Pick<Receivable, 'personName' | 'amount' | 'paidAmount' | 'dueDate' | 'type' | 'status'>[];
  /** The holdings: the type and the current value. */
  holdingDetails?: Pick<Holding, 'type' | 'quantity' | 'currentPrice'>[];
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
    dayChangePaise: dayChangeIn = 0,
    portfolioValuePaise: portfolioValueIn = 0,
    garageFills = [],
    fixedExpenseNames = [],
    cardDetails = [],
    bankDetails = [],
    receivableDetails = [],
    holdingDetails = [],
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

  // Credit card bills — the same rule the app uses everywhere:
  //   I (balance ?? current_outstanding)
  const ccBillsPaise = cards.reduce(
    (sum, c) => sum + (Number(c.balance ?? c.currentOutstanding ?? 0) || 0),
    0
  );

  const bankBalancePaise = accounts.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
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

  // Market today — the same formula as the Wealth dashboard's day-change card.
  const dayChangePaise = Number.isFinite(dayChangeIn) ? dayChangeIn : 0;
  const portfolioValuePaise = Number.isFinite(portfolioValueIn) ? portfolioValueIn : 0;
  const dayChangePct =
    portfolioValuePaise > 0
      ? (dayChangePaise / Math.max(1, portfolioValuePaise - dayChangePaise)) * 100
      : 0;

  // --- the rows of the screens -----------------------------------------------

  // The cards: the biggest three. The due date rides with the card name (the
  // amount stays on the right) so the whole row fits the 2x2 cell.
  const cardRows: WidgetRow[] = [...cardDetails]
    .sort((a, b) => (b.balance ?? b.currentOutstanding ?? 0) - (a.balance ?? a.currentOutstanding ?? 0))
    .slice(0, 3)
    .map((c) => {
      const amount = c.balance ?? c.currentOutstanding ?? 0;
      const due = formatShortDate(c.dueDate);
      return {
        name: `${c.name || 'Card'}${due ? ` ${due}` : ''}`,
        value: formatRowMoney(amount),
      };
    });

  // The banks: the biggest three.
  const bankRows: WidgetRow[] = [...bankDetails]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 3)
    .map((a) => ({ name: a.title || 'Bank', value: formatRowMoney(a.amount || 0) }));

  // The lent money: the unpaid ones, the late ones in red.
  const lentRows: WidgetRow[] = receivableDetails
    .filter((r) => r.type === 'lent' && r.status !== 'paid')
    .map((r) => {
      const outstanding = (r.amount || 0) - (r.paidAmount || 0);
      const dueDate = r.dueDate ? new Date(r.dueDate) : null;
      const late = !!dueDate && !Number.isNaN(dueDate.getTime()) && istDateKey(dueDate) < dayKey;
      return {
        name: r.personName || 'Lent',
        value: `${formatRowMoney(outstanding)}${late ? ' · late' : ''}`,
        late,
      };
    })
    .sort((a, b) => Number(b.late) - Number(a.late))
    .slice(0, 3);

  // The tasks: the pending ones first (by their due date), then the finished
  // ones (they are drawn struck through).
  const taskRows: WidgetRow[] = [...tasks]
    .sort((a, b) => {
      if (!!a.completed !== !!b.completed) return Number(a.completed) - Number(b.completed);
      return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
    })
    .slice(0, 3)
    .map((t) => ({ name: t.name || 'Task', value: '', done: !!t.completed }));

  // The wealth split: the equity / MF / other share of the holdings.
  let equityValue = 0;
  let mfValue = 0;
  let otherValue = 0;
  for (const h of holdingDetails) {
    const value = (h.quantity || 0) * (h.currentPrice || 0) * 100; // paise
    if (h.type === 'equity' || h.type === 'etf') equityValue += value;
    else if (h.type === 'mf') mfValue += value;
    else otherValue += value;
  }
  const totalHoldings = equityValue + mfValue + otherValue;
  const pct = (v: number) => (totalHoldings > 0 ? Math.round((v / totalHoldings) * 100) : 0);
  const equityPct = pct(equityValue);
  const mfPct = pct(mfValue);
  const otherPct = Math.max(0, 100 - equityPct - mfPct);

  return {
    dayKey,
    monthKey,
    monthlySpendPaise,
    ccBillsPaise,
    bankBalancePaise,
    netLentPaise,
    tasksLeft,
    netWorthPaise: Number.isFinite(netWorthPaise) ? netWorthPaise : 0,
    dayChangePaise,
    dayChangePct,
    portfolioValuePaise,
    cardRows,
    bankRows,
    lentRows,
    taskRows,
    wealthSplit: [equityPct, mfPct, otherPct],
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
    dayChangePaise: inv.getTodayPnL(),
    portfolioValuePaise: inv.getPortfolioValue(),
    garageFills: g.fills,
    fixedExpenseNames: f.fixedExpenses.map((fx) => fx.name),
    cardDetails: f.cards,
    bankDetails: f.accounts,
    receivableDetails: f.receivables,
    holdingDetails: inv.holdings,
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
