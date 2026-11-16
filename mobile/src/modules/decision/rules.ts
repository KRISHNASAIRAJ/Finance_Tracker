/**
 * Today's call — a deterministic, priority-ordered rule engine (spec §4).
 *
 * The single highest-priority rule that fires becomes the call. Every other
 * rule that fired is returned under "Also worth a look". No AI, no network,
 * no writes. All copy is original Meridian wording.
 */

import { computeBaseline } from './baseline';
import { DECISION_CONFIG } from './config';
import { daysBetween } from './day';
import { formatRupees } from '../finance/financeFormat';
import type { DecisionCall, EngineInput, EvidenceItem } from './types';

function formatDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function chip(
  id: string,
  label: string,
  value: string,
  target: EvidenceItem['target']
): EvidenceItem {
  return { id, label, value, target };
}

interface RuleContext {
  input: EngineInput;
  sleepNormal: number;
  spendNormal: number;
}

/** Each rule returns a call when it fires, otherwise null. */
type Rule = (ctx: RuleContext) => DecisionCall | null;

function call(
  input: EngineInput,
  ruleId: DecisionCall['ruleId'],
  headline: string,
  reason: string,
  evidence: EvidenceItem[],
  target: DecisionCall['target']
): DecisionCall {
  return { date: input.today, ruleId, headline, reason, evidence, target, alsoConsider: [] };
}

const cashflowRule: Rule = ({ input }) => {
  const { shortfallDate, shortfallPaise } = input.projection;
  if (!shortfallDate || shortfallPaise <= 0) return null;
  const days = daysBetween(input.today, shortfallDate);
  if (days < 0 || days > DECISION_CONFIG.rules.cashflowHorizonDays) return null;

  const evidence: EvidenceItem[] = [
    chip('projection', 'Cash gap', formatRupees(shortfallPaise), 'CashFlowForecast'),
  ];
  if (input.receivable) {
    evidence.push(
      chip(
        'receivable',
        'Collect',
        `${formatRupees(input.receivable.amountPaise)} · ${formatDay(input.receivable.date)}`,
        'LentBorrowed'
      )
    );
  }
  if (input.bill) {
    evidence.push(
      chip('bill', 'Bill', `${formatRupees(input.bill.amountPaise)} · ${formatDay(input.bill.date)}`, 'FixedExpenses')
    );
  }

  const collect = input.receivable
    ? ` Collect ${formatRupees(input.receivable.amountPaise)} from ${input.receivable.name} by ${formatDay(input.receivable.date)}.`
    : '';
  return call(
    input,
    'cashflow',
    `Tight until ${formatDay(shortfallDate)}.${collect}`,
    `Your balance dips below its minimum on ${formatDay(shortfallDate)}.`,
    evidence.slice(0, 3),
    'CashFlowForecast'
  );
};

const billRule: Rule = ({ input }) => {
  const bill = input.bill;
  if (!bill || !input.projection.balanceAfterBillBelowMin) return null;
  const days = daysBetween(input.today, bill.date);
  if (days < 0 || days > DECISION_CONFIG.rules.billWindowDays) return null;

  return call(
    input,
    'bill',
    `Move money before ${bill.name} on ${formatDay(bill.date)}.`,
    'Paying this bill would take your balance under its minimum.',
    [
      chip('bill', 'Bill', `${formatRupees(bill.amountPaise)} · ${formatDay(bill.date)}`, 'FixedExpenses'),
      chip('balance', 'After bill', 'Below minimum', 'CashFlowForecast'),
    ],
    'FixedExpenses'
  );
};

const budgetRule: Rule = ({ input }) => {
  if (input.budgetPace === null || input.budgetPace <= DECISION_CONFIG.rules.budgetPace) return null;
  const pacePct = Math.round(input.budgetPace * 100);
  const top = input.topCategory;
  const hold = top
    ? ` Hold ${top.name} to ${formatRupees(top.suggestedTodayPaise)} today.`
    : '';

  return call(
    input,
    'budget',
    `Over pace.${hold}`,
    `Month spend is at ${pacePct}% of the pace for ${new Date().getDate()} days elapsed.`,
    [
      chip('pace', 'Month pace', `${pacePct}% of plan`, 'MonthlySpend'),
      ...(top
        ? [chip('category', top.name, formatRupees(top.suggestedTodayPaise), 'MonthlySpend')]
        : []),
    ],
    'MonthlySpend'
  );
};

const shortNightRule: Rule = ({ input, sleepNormal, spendNormal }) => {
  if (input.sleepLastNightMinutes === null) return null;
  const shortfall = sleepNormal - input.sleepLastNightMinutes;
  if (shortfall < DECISION_CONFIG.rules.shortNightMinutes) return null;
  if (input.dailySpendRupees === null) return null;
  if (input.dailySpendRupees <= spendNormal * DECISION_CONFIG.rules.highSpendMultiple) return null;

  return call(
    input,
    'shortNight',
    'Short night. Skip unplanned spends today.',
    `You slept ${Math.round(shortfall)} min under your normal and spend is running high.`,
    [
      chip('sleep', 'Last night', `${Math.round(input.sleepLastNightMinutes)} min`, 'SleepTracker'),
      chip('normal', 'Your normal', `${Math.round(sleepNormal)} min`, 'SleepTracker'),
      chip('spend', 'Today', formatRupees(input.dailySpendRupees * 100), 'FinanceHome'),
    ],
    'SleepTracker'
  );
};

const overdueTaskRule: Rule = ({ input }) => {
  const task = input.overdueUrgentTask;
  if (!task) return null;
  return call(
    input,
    'overdueTask',
    `Clear ${task} first.`,
    'An urgent task is past its due time.',
    [chip('task', 'Overdue', task, 'TasksDashboard')],
    'TasksDashboard'
  );
};

const steadyRule: Rule = ({ input }) => {
  const next = input.nextDueItem ? ` ${input.nextDueItem}.` : '';
  return call(
    input,
    'steady',
    `Steady day.${next}`,
    'Nothing needs a decision right now.',
    [chip('overview', 'Money', 'On track', 'FinanceHome')],
    'FinanceHome'
  );
};

/** Highest priority first — the first firing rule wins. */
const RULES: Rule[] = [
  cashflowRule,
  billRule,
  budgetRule,
  shortNightRule,
  overdueTaskRule,
  steadyRule,
];

export function pickCall(input: EngineInput): DecisionCall {
  const sleepBase = computeBaseline({
    metric: 'sleep',
    samples: input.samples.sleep ?? [],
    today: input.today,
    fallbackTarget: DECISION_CONFIG.fallback.sleepMinutes,
  });
  const spendBase = computeBaseline({
    metric: 'spend',
    samples: input.samples.spend ?? [],
    today: input.today,
    fallbackTarget: DECISION_CONFIG.fallback.dailySpendRupees,
    weekdayAware: true,
  });

  const ctx: RuleContext = {
    input,
    sleepNormal: sleepBase.median,
    spendNormal: spendBase.median,
  };

  const fired = RULES.map((rule) => rule(ctx)).filter(
    (c): c is DecisionCall => c !== null
  );
  const winner: DecisionCall = fired[0] ?? steadyRule(ctx)!;
  const winnerId = winner.ruleId;
  winner.alsoConsider = fired
    .filter((c) => c.ruleId !== winnerId && c.ruleId !== 'steady')
    .slice(0, 2);
  return winner;
}
