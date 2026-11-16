import type { EngineInput } from '../types';

/** A neutral, fully-populated input. Tests override only what they care about. */
export function makeInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    today: '2026-11-16',
    yesterday: '2026-11-15',
    samples: {},
    sleepLastNightMinutes: 420,
    dailySpendRupees: 1000,
    habitsYesterdayRate: 0.7,
    tasksYesterdayRate: 0.7,
    tasksDueToday: 1,
    billsDueSoon: 1,
    overdueUrgentTask: null,
    nextDueItem: 'Electricity bill on 22 Nov',
    projection: {
      shortfallDate: null,
      lowestBalancePaise: 5_000_000,
      shortfallPaise: 0,
      balanceAfterBillBelowMin: false,
    },
    bill: null,
    receivable: null,
    budgetPace: 0.8,
    topCategory: null,
    ...overrides,
  };
}
