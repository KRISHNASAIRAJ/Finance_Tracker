/**
 * Bridges the existing offline-first stores to the pure decision engine.
 *
 * Reads only. It never writes to any store, calls an edge function, or
 * changes user data — the whole layer is a view over what Meridian already
 * knows. All inputs are memoised on the store slices they come from.
 */

import { useMemo } from 'react';

import { useFinanceStore, getMinBalanceForAccount } from '../../finance/store';
import { localDayKey, shiftLocalDayKey, asDayKey } from '../../finance/financeFormat';
import {
  buildForecastEvents,
  computeAverageDailySpend,
  computeCashFlow,
} from '../../finance/forecast';
import { sleepDurationHours, useSleepStore } from '../../sleep/store';
import { useHabitDefs, useHabitStore } from '../../habits/store';
import { useTasksStore } from '../../tasks/store';
import { computeBaseline } from '../baseline';
import { DECISION_CONFIG } from '../config';
import { computeDayScore } from '../score';
import { pickCall } from '../rules';
import type { EngineInput, Metric, Sample } from '../types';

const SPEND_TYPES = new Set(['expense', 'fuel_purchase', 'vehicle_service']);
const EXCLUDED_CATEGORIES = new Set([
  'wallet loads',
  'wallet load',
  'rent',
  'sip',
  'investments',
  'housing',
]);

function isSpend(t: { type: string; category?: string; notes?: string }): boolean {
  const cat = (t.category || '').toLowerCase();
  const notes = (t.notes || '').toLowerCase();
  return (
    SPEND_TYPES.has(t.type) &&
    !EXCLUDED_CATEGORIES.has(cat) &&
    !notes.includes('wallet load') &&
    !notes.includes('payzapp')
  );
}

function dayOf(iso: string): string {
  return localDayKey(new Date(iso));
}

function keyOf(value: string): string {
  return asDayKey(value) ?? dayOf(value);
}

function shortDate(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
}

export interface DecisionResult {
  input: EngineInput;
  score: ReturnType<typeof computeDayScore>;
  call: ReturnType<typeof pickCall>;
  baselines: Partial<Record<Metric, ReturnType<typeof computeBaseline>>>;
  sleepMinutes: number | null;
  dailySpendRupees: number | null;
  tasksDueToday: number;
  billsDueSoon: number;
  budgetPace: number | null;
  topCategory: { name: string; suggestedTodayPaise: number } | null;
}

export function useDecisionEngine(): DecisionResult {
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const wallets = useFinanceStore((s) => s.wallets);
  const fixedExpenses = useFinanceStore((s) => s.fixedExpenses);
  const cards = useFinanceStore((s) => s.cards);
  const receivables = useFinanceStore((s) => s.receivables);
  const monthlyBudget = useFinanceStore((s) => s.monthlyBudget);

  const sleepEntries = useSleepStore((s) => s.entries);
  const habitDays = useHabitStore((s) => s.days);
  const habitDefs = useHabitDefs();
  const tasks = useTasksStore((s) => s.tasks);

  return useMemo(() => {
    const now = new Date();
    const today = localDayKey(now);
    const yesterday = shiftLocalDayKey(today, -1);
    const windowStart = shiftLocalDayKey(today, -DECISION_CONFIG.baseline.windowDays);
    const monthKey = today.slice(0, 7);
    const monthStartDay = Number(today.slice(8, 10));
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // ── Personal-normal samples (ending yesterday) ─────────
    const sleepByDay = new Map<string, number>();
    for (const e of sleepEntries) {
      const day = dayOf(e.endTime);
      if (day >= windowStart && day <= yesterday) {
        sleepByDay.set(day, sleepDurationHours(e) * 60);
      }
    }
    const sleepSamples: Sample[] = [...sleepByDay].map(([day, value]) => ({ day, value }));

    const spendByDay = new Map<string, number>();
    const monthCategoryPaise = new Map<string, number>();
    let dailySpendRupees = 0;
    for (const t of transactions) {
      if (!isSpend(t)) continue;
      const day = dayOf(t.date);
      const rupees = t.amount / 100;
      if (day >= windowStart && day <= yesterday) {
        spendByDay.set(day, (spendByDay.get(day) ?? 0) + rupees);
      }
      if (day === today) dailySpendRupees += rupees;
      if (day.slice(0, 7) === monthKey && t.category) {
        monthCategoryPaise.set(
          t.category,
          (monthCategoryPaise.get(t.category) ?? 0) + t.amount
        );
      }
    }
    const spendSamples: Sample[] = [...spendByDay].map(([day, value]) => ({ day, value }));

    const habitSamples: Sample[] = habitDays
      .filter((d) => d.day >= windowStart && d.day <= yesterday && habitDefs.length > 0)
      .map((d) => ({ day: d.day, value: d.habits.length / habitDefs.length }));

    const taskSamples: Sample[] = [];
    for (let i = 1; i <= DECISION_CONFIG.baseline.windowDays; i += 1) {
      const day = shiftLocalDayKey(today, -i);
      const due = tasks.filter((t) => dayOf(t.dueDate) === day);
      if (due.length === 0) continue;
      taskSamples.push({ day, value: due.filter((t) => t.completed).length / due.length });
    }

    const habitsYesterday = habitDays.find((d) => d.day === yesterday);
    const habitsYesterdayRate =
      habitsYesterday && habitDefs.length > 0
        ? habitsYesterday.habits.length / habitDefs.length
        : null;
    const tasksYesterday = tasks.filter((t) => dayOf(t.dueDate) === yesterday);
    const tasksYesterdayRate =
      tasksYesterday.length > 0
        ? tasksYesterday.filter((t) => t.completed).length / tasksYesterday.length
        : null;

    // ── Commitments ────────────────────────────────────────
    const openTasks = tasks.filter((t) => !t.completed);
    const tasksDueToday = openTasks.filter((t) => dayOf(t.dueDate) === today).length;

    const soon = shiftLocalDayKey(today, DECISION_CONFIG.rules.billWindowDays);
    const upcomingFixed = fixedExpenses.filter((f) => {
      const key = keyOf(f.dueDate);
      return key >= today && key <= soon && !(f.lastPaidMonth && f.lastPaidMonth >= monthKey);
    });
    const upcomingCards = cards.filter((c) => {
      const key = keyOf(c.dueDate);
      return key >= today && key <= soon && (c.billAmount ?? c.balance ?? 0) > 0;
    });
    const billsDueSoon = upcomingFixed.length + upcomingCards.length;

    const overdueUrgent = openTasks
      .filter((t) => t.priority === 'urgent' && dayOf(t.dueDate) < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    const nextBill = [...upcomingFixed, ...upcomingCards].sort((a, b) =>
      keyOf(a.dueDate).localeCompare(keyOf(b.dueDate))
    )[0];
    const nextTask = openTasks
      .filter((t) => dayOf(t.dueDate) >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const nextDueItem = nextBill
      ? `${nextBill.name} on ${shortDate(keyOf(nextBill.dueDate))}`
      : nextTask
        ? `${nextTask.name} on ${shortDate(dayOf(nextTask.dueDate))}`
        : null;

    // ── Cash-flow projection (reuses the existing forecast) ──
    const startBalancePaise =
      accounts.reduce((s, a) => s + a.amount, 0) +
      wallets.reduce((s, w) => s + w.amount, 0);
    const minBalancePaise = accounts.reduce(
      (s, a) => s + getMinBalanceForAccount(a.title),
      0
    );
    const avgDailyPaise = computeAverageDailySpend(
      transactions,
      fixedExpenses.map((f) => f.name),
      shiftLocalDayKey(today, -30),
      yesterday,
      30
    );
    const forecastDays = DECISION_CONFIG.rules.cashflowHorizonDays;
    const events = buildForecastEvents({
      fixedExpenses,
      cards,
      receivables,
      startKey: today,
      endKey: shiftLocalDayKey(today, forecastDays),
    });
    const forecast = computeCashFlow({
      days: forecastDays,
      startKey: today,
      startBalancePaise,
      minBalancePaise,
      dailySpendPaise: avgDailyPaise,
      events,
    });
    const shortfallDate = forecast.status === 'short' ? forecast.tightestDateKey : null;
    const shortfallPaise = Math.max(0, -forecast.headroomPaise);

    const nextBillPaise = nextBill
      ? 'amount' in nextBill
        ? nextBill.amount
        : nextBill.billAmount ?? nextBill.balance ?? 0
      : 0;
    const balanceAfterBillBelowMin =
      Boolean(nextBill) && startBalancePaise - nextBillPaise < minBalancePaise;

    const nextReceivable = receivables
      .filter(
        (r) => r.type === 'lent' && r.amount > r.paidAmount && keyOf(r.dueDate) <= soon
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const receivable = nextReceivable
      ? {
          name: nextReceivable.personName,
          date: keyOf(nextReceivable.dueDate),
          amountPaise: nextReceivable.amount - nextReceivable.paidAmount,
        }
      : null;

    // ── Budget pace ────────────────────────────────────────
    const monthSpendPaise = [...monthCategoryPaise.values()].reduce((a, b) => a + b, 0);
    const budgetPace =
      monthlyBudget > 0
        ? monthSpendPaise / 100 / monthlyBudget / (monthStartDay / daysInMonth)
        : null;
    const topEntry = [...monthCategoryPaise].sort((a, b) => b[1] - a[1])[0];
    const topCategory = topEntry
      ? {
          name: topEntry[0],
          suggestedTodayPaise: Math.round(
            (monthlyBudget > 0
              ? monthlyBudget / daysInMonth
              : topEntry[1] / 100 / monthStartDay) * 100
          ),
        }
      : null;

    // ── Assemble the engine input ──────────────────────────
    const sortedSleep = [...sleepEntries].sort(
      (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    )[0];
    const input: EngineInput = {
      today,
      yesterday,
      samples: { sleep: sleepSamples, spend: spendSamples, habits: habitSamples, tasks: taskSamples },
      sleepLastNightMinutes: sortedSleep ? sleepDurationHours(sortedSleep) * 60 : null,
      dailySpendRupees,
      habitsYesterdayRate,
      tasksYesterdayRate,
      tasksDueToday,
      billsDueSoon,
      overdueUrgentTask: overdueUrgent?.name ?? null,
      nextDueItem,
      projection: {
        shortfallDate,
        lowestBalancePaise: forecast.tightestPaise,
        shortfallPaise,
        balanceAfterBillBelowMin,
      },
      bill: nextBill
        ? { name: nextBill.name, date: keyOf(nextBill.dueDate), amountPaise: nextBillPaise }
        : null,
      receivable,
      budgetPace,
      topCategory,
    };

    const baselines: DecisionResult['baselines'] = {
      sleep: computeBaseline({
        metric: 'sleep',
        samples: sleepSamples,
        today,
        fallbackTarget: DECISION_CONFIG.fallback.sleepMinutes,
      }),
      spend: computeBaseline({
        metric: 'spend',
        samples: spendSamples,
        today,
        fallbackTarget: DECISION_CONFIG.fallback.dailySpendRupees,
        weekdayAware: true,
      }),
      habits: computeBaseline({
        metric: 'habits',
        samples: habitSamples,
        today,
        fallbackTarget: DECISION_CONFIG.fallback.habitsDoneRate,
      }),
      tasks: computeBaseline({
        metric: 'tasks',
        samples: taskSamples,
        today,
        fallbackTarget: DECISION_CONFIG.fallback.tasksDoneRate,
      }),
    };

    return {
      input,
      score: computeDayScore(input),
      call: pickCall(input),
      baselines,
      sleepMinutes: input.sleepLastNightMinutes,
      dailySpendRupees,
      tasksDueToday,
      billsDueSoon,
      budgetPace,
      topCategory,
    };
  }, [
    transactions,
    accounts,
    wallets,
    fixedExpenses,
    cards,
    receivables,
    monthlyBudget,
    sleepEntries,
    habitDays,
    habitDefs,
    tasks,
  ]);
}
