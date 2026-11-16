/** Shared types for the decision-first engine. All functions are pure. */

export type Metric = 'sleep' | 'spend' | 'habits' | 'tasks';
export type ComponentKey = 'sleep' | 'moneyPace' | 'commitments' | 'habits';

/** A single dated observation used to build a personal normal. */
export interface Sample {
  /** IST day key, YYYY-MM-DD. */
  day: string;
  value: number;
}

export interface Baseline {
  metric: Metric;
  windowDays: number;
  median: number;
  spread: number;
  sampleN: number;
  /** True when a fixed target is in use (< minSamples). */
  learning: boolean;
  /** True when the same-weekday series won for a spend baseline. */
  weekdayAware: boolean;
}

export interface ScoreComponent {
  key: ComponentKey;
  /** 0..100 contribution. */
  score: number;
  /** Original weight before missing-component re-weighting. */
  baseWeight: number;
  /** Effective weight after re-weighting. */
  weight: number;
  /** What was measured, in the component's own unit. */
  value: number;
  /** Personal normal (or fixed target) the value was compared to. */
  normal: number;
  /** Short, plain-language explanation shown in the sheet. */
  reason: string;
}

export type Band = 'Good' | 'Steady' | 'Low';

export interface DayScore {
  date: string;
  score: number;
  band: Band;
  components: ScoreComponent[];
  /** Components with no source data; they were dropped and re-weighted. */
  missing: ComponentKey[];
  /** Components below the minimum sample count (fixed target in use). */
  learning: Metric[];
}

/** A chip that opens the screen the evidence came from. */
export interface EvidenceItem {
  id: string;
  label: string;
  value: string;
  /** Route name on MoreStack, or a tab route descriptor. */
  target: EvidenceTarget;
}

export type EvidenceTarget =
  | 'CashFlowForecast'
  | 'LentBorrowed'
  | 'FixedExpenses'
  | 'CreditCards'
  | 'MonthlySpend'
  | 'FinanceHome'
  | 'SleepTracker'
  | 'HabitTracker'
  | 'TasksDashboard';

export type CallRuleId =
  | 'cashflow'
  | 'bill'
  | 'budget'
  | 'shortNight'
  | 'overdueTask'
  | 'steady';

export interface DecisionCall {
  date: string;
  ruleId: CallRuleId;
  headline: string;
  reason: string;
  evidence: EvidenceItem[];
  target: EvidenceTarget;
  /** Other rules that also fired, shown under "Also worth a look". */
  alsoConsider: DecisionCall[];
}

/** Everything the engine needs for one day. Built by the hook from stores. */
export interface EngineInput {
  today: string;
  yesterday: string;

  /** Samples ending yesterday (today is not complete yet). */
  samples: Partial<Record<Metric, Sample[]>>;

  sleepLastNightMinutes: number | null;
  dailySpendRupees: number | null;
  habitsYesterdayRate: number | null;
  tasksYesterdayRate: number | null;

  /** Counts used by the commitments component and the rules. */
  tasksDueToday: number;
  billsDueSoon: number;
  overdueUrgentTask: string | null;
  nextDueItem: string | null;

  /** Cash-flow facts, all derived from the existing forecast. */
  projection: {
    shortfallDate: string | null;
    lowestBalancePaise: number;
    shortfallPaise: number;
    balanceAfterBillBelowMin: boolean;
  };
  bill: { name: string; date: string; amountPaise: number } | null;
  receivable: { name: string; date: string; amountPaise: number } | null;

  /** Month budget pace: spend% / elapsed% (1 = on plan); null when unknown. */
  budgetPace: number | null;
  topCategory: { name: string; suggestedTodayPaise: number } | null;
}
