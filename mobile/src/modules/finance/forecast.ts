/**
 * forecast â€” the pure math behind the Cash flow forecast screen (s35).
 *
 * Everything is integer paise. All dates are local YYYY-MM-DD day keys.
 * No imports from stores or UI â€” the screen feeds these functions and tests
 * feed them fixtures, so the numbers are verifiable without a phone.
 */

import { asDayKey, dayKeyRange, localDayKey, shiftLocalDayKey } from './financeFormat';

export type ForecastEventKind = 'card' | 'fixed' | 'sip' | 'lent';

export interface ForecastEvent {
  id: string;
  /** Local day key the money moves. */
  dateKey: string;
  /** Person / card / bill name â€” shown as the row title. */
  title: string;
  /** "Card due" / "Lent money" / "SIP" / "Fixed expense". */
  subtitle: string;
  /** Negative = money out, positive = money in. */
  amountPaise: number;
  kind: ForecastEventKind;
}

export type ForecastStatus = 'safe' | 'tight' | 'short';

export interface LentRisk {
  name: string;
  amountPaise: number;
  dueDateKey: string;
  /** First day the balance would dip below the minimum without this money. */
  firstDipDateKey: string;
  /** How far below the minimum it dips (positive paise). */
  belowPaise: number;
}

export interface CashFlowInput {
  /** Window length in days from `startKey` (inclusive). */
  days: number;
  startKey: string;
  /** Banks + wallets today, paise. */
  startBalancePaise: number;
  /** Sum of the account minimum-balance requirements, paise. */
  minBalancePaise: number;
  /** User-chosen everyday spend per day, paise. */
  dailySpendPaise: number;
  events: ForecastEvent[];
}

export interface CashFlowForecast {
  days: number;
  startKey: string;
  endKey: string;
  startBalancePaise: number;
  minBalancePaise: number;
  dailySpendPaise: number;
  /** Events inside the window, sorted by day. */
  eventsInWindow: ForecastEvent[];
  /** Balance at end of each day in the window (index 0 = day 1). */
  dailyBalances: number[];
  /** Balance on the last day of the window. */
  projectedEndPaise: number;
  /** Lowest point in the window. */
  tightestPaise: number;
  /** The day the tightest point falls on. */
  tightestDateKey: string;
  /** tightestPaise - minBalancePaise (negative when under). */
  headroomPaise: number;
  status: ForecastStatus;
  /** The riskiest lent item whose removal pushes us under the minimum. */
  lentRisk: LentRisk | null;
}

/**
 * The headroom below which the status reads "tight": either â‚¹2,500 or 10 % of
 * the minimum balances, whichever is larger. Above that it is "safe".
 */
export function tightHeadroomThreshold(minBalancePaise: number): number {
  return Math.max(250000, Math.round(minBalancePaise * 0.1));
}

function applyEvents(
  balance: number,
  eventMap: Map<string, number>,
  dayKey: string,
): number {
  return balance + (eventMap.get(dayKey) ?? 0);
}

function walk(
  input: CashFlowInput,
  skipLentId: string | null,
): { dailyBalances: number[]; projectedEndPaise: number; tightestPaise: number; tightestDateKey: string } {
  const { days, startKey, startBalancePaise, dailySpendPaise, events } = input;
  const eventMap = new Map<string, number>();
  for (const ev of events) {
    if (skipLentId && ev.id === skipLentId) continue;
    eventMap.set(ev.dateKey, (eventMap.get(ev.dateKey) ?? 0) + ev.amountPaise);
  }
  const keys = dayKeyRange(startKey, shiftLocalDayKey(startKey, days));
  // keys has days + 1 entries; every index is a day in the window and every
  // day applies its spend and its events, including today.
  let balance = startBalancePaise;
  const dailyBalances: number[] = new Array(keys.length);
  let tightestPaise = balance;
  let tightestDateKey = keys[0];
  for (let i = 0; i < keys.length; i += 1) {
    // Day 0 (today) applies only today's movements — the forecast subtracts
    // one day of everyday spend per day in the window, starting tomorrow.
    if (i > 0) balance -= dailySpendPaise;
    balance = applyEvents(balance, eventMap, keys[i]);
    dailyBalances[i] = balance;
    if (balance < tightestPaise) {
      tightestPaise = balance;
      tightestDateKey = keys[i];
    }
  }
  return {
    dailyBalances,
    projectedEndPaise: dailyBalances[keys.length - 1],
    tightestPaise,
    tightestDateKey,
  };
}

export function computeCashFlow(input: CashFlowInput): CashFlowForecast {
  const { days, minBalancePaise, events, startKey } = input;
  const endKey = shiftLocalDayKey(startKey, days);
  const eventsInWindow = events
    .filter((ev) => ev.dateKey >= startKey && ev.dateKey <= endKey)
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));

  const base = walk({ ...input, events: eventsInWindow }, null);
  const headroomPaise = base.tightestPaise - minBalancePaise;
  const threshold = tightHeadroomThreshold(minBalancePaise);
  const status: ForecastStatus =
    base.tightestPaise < minBalancePaise ? 'short' : headroomPaise <= threshold ? 'tight' : 'safe';

  // Lent-risk probe: drop one inflow at a time and see if it tips us under.
  let lentRisk: LentRisk | null = null;
  for (const ev of eventsInWindow) {
    if (ev.kind !== 'lent' || ev.amountPaise <= 0) continue;
    const probe = walk({ ...input, events: eventsInWindow }, ev.id);
    const firstDipIndex = probe.dailyBalances.findIndex((b) => b < minBalancePaise);
    if (firstDipIndex === -1) continue;
    const dip = minBalancePaise - probe.dailyBalances[firstDipIndex];
    if (!lentRisk || dip > lentRisk.belowPaise) {
      lentRisk = {
        name: ev.title,
        amountPaise: ev.amountPaise,
        dueDateKey: ev.dateKey,
        firstDipDateKey: dayKeyRange(startKey, endKey)[firstDipIndex],
        belowPaise: dip,
      };
    }
  }

  return {
    days,
    startKey,
    endKey,
    startBalancePaise: input.startBalancePaise,
    minBalancePaise,
    dailySpendPaise: input.dailySpendPaise,
    eventsInWindow,
    dailyBalances: base.dailyBalances,
    projectedEndPaise: base.projectedEndPaise,
    tightestPaise: base.tightestPaise,
    tightestDateKey: base.tightestDateKey,
    headroomPaise,
    status,
    lentRisk,
  };
}

/** Average true daily spend over `windowDays` ending today (wallet loads and
 * SIPs excluded, as everywhere else in Meridian). `fromKey`/`toKey` are
 * inclusive day keys; the divisor is the window length, not the count of
 * spend days â€” a quiet week should read as â‚¹0/day, not â‚¹0 spend.
 */
export function computeAverageDailySpend(
  transactions: ReadonlyArray<{
    type: string;
    amount: number;
    date: string;
    category: string;
    notes?: string | null;
  }>,
  fixedExpenseNames: ReadonlyArray<string>,
  fromKey: string,
  toKey: string,
  windowDays: number,
): number {
  const excludedCategories = new Set([
    'rent',
    'sip',
    'investments',
    'housing',
    'wallet loads',
    'wallet load',
    ...fixedExpenseNames.map((n) => n.toLowerCase()),
  ]);
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' && tx.type !== 'fuel_purchase' && tx.type !== 'vehicle_service') continue;
    const category = (tx.category || '').toLowerCase();
    const notes = (tx.notes || '').toLowerCase();
    if (excludedCategories.has(category)) continue;
    if (notes.includes('wallet load') || notes.includes('payzapp')) continue;
    const dayKey = asDayKey(tx.date);
    if (!dayKey) continue;
    if (dayKey < fromKey || dayKey > toKey) continue;
    total += tx.amount;
  }
  return windowDays > 0 ? Math.round(total / windowDays) : 0;
}

/** The next local day key on which a monthly bill due on `billingDay` falls,
 * strictly after `fromKey` (or on it, if it is still ahead today). */
export function nextMonthlyDue(billingDay: number, fromKey: string): string {
  const [y, m, d] = fromKey.split('-').map(Number);
  const from = new Date(y, (m || 1) - 1, d || 1);
  for (let i = 0; i < 24; i += 1) {
    const candidate = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    const day = Math.min(Math.max(1, billingDay), lastDay);
    const date = new Date(candidate.getFullYear(), candidate.getMonth(), day);
    const key = localDayKey(date);
    if (key >= fromKey) return key;
  }
  return fromKey;
}

/** Build the forecast events from the real stores. All inputs are the raw
 * rows; pure and synchronous. */
export function buildForecastEvents(args: {
  fixedExpenses: ReadonlyArray<{
    id: string;
    name: string;
    amount: number;
    billingDay: number;
    category: string;
    lastPaidMonth: string;
  }>;
  cards: ReadonlyArray<{
    id: string;
    name: string;
    balance: number;
    billAmount?: number | null;
    paidAmount?: number | null;
    dueDate: string;
  }>;
  receivables: ReadonlyArray<{
    id: string;
    personName: string;
    amount: number;
    paidAmount: number;
    dueDate: string;
    type: 'lent' | 'borrowed';
  }>;
  startKey: string;
  endKey: string;
}): ForecastEvent[] {
  const { fixedExpenses, cards, receivables, startKey, endKey } = args;
  const events: ForecastEvent[] = [];

  const rollToNextMonth = (dateKey: string, billingDay: number): string => {
    const [y, m] = dateKey.split('-').map(Number);
    const next = new Date(y, m, 1); // m is 1-based â†’ the following month
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const day = Math.min(Math.max(1, billingDay), lastDay);
    return localDayKey(new Date(next.getFullYear(), next.getMonth(), day));
  };

  for (const f of fixedExpenses) {
    // The next occurrence, strictly honouring "this month already paid".
    let dateKey = nextMonthlyDue(f.billingDay, startKey);
    if (f.lastPaidMonth && f.lastPaidMonth >= dateKey.slice(0, 7)) {
      dateKey = rollToNextMonth(dateKey, f.billingDay);
    }
    if (dateKey < startKey || dateKey > endKey) continue;
    const isSip =
      (f.category || '').toLowerCase() === 'investments' ||
      f.name.toLowerCase().includes('sip');
    events.push({
      id: `fx_${f.id}_${dateKey}`,
      dateKey,
      title: f.name,
      subtitle: isSip ? 'SIP' : 'Fixed expense',
      amountPaise: -Math.abs(f.amount),
      kind: isSip ? 'sip' : 'fixed',
    });
  }

  for (const c of cards) {
    const statement = Math.max(0, (c.billAmount ?? c.balance ?? 0) - (c.paidAmount ?? 0));
    if (statement <= 0) continue;
    const dateKey = asDayKey(c.dueDate);
    if (!dateKey) continue;
    if (dateKey < startKey || dateKey > endKey) continue;
    events.push({
      id: `card_${c.id}`,
      dateKey,
      title: `${c.name} bill`,
      subtitle: 'Card due',
      amountPaise: -statement,
      kind: 'card',
    });
  }

  for (const r of receivables) {
    if (r.type !== 'lent') continue;
    const remaining = Math.max(0, r.amount - (r.paidAmount ?? 0));
    if (remaining <= 0) continue;
    const dateKey = asDayKey(r.dueDate);
    if (!dateKey) continue;
    if (dateKey < startKey || dateKey > endKey) continue;
    events.push({
      id: `lent_${r.id}`,
      dateKey,
      title: r.personName,
      subtitle: 'Lent money',
      amountPaise: remaining,
      kind: 'lent',
    });
  }

  return events.sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
}
