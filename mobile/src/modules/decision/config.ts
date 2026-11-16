/**
 * Single source of truth for every weight, threshold and band used by the
 * decision-first layer. Screens must never hardcode these numbers; they read
 * them from here so the "How this is calculated" sheet can show the exact
 * same values the engine used.
 *
 * Spec: docs/tracend/02_PRODUCT_SPEC.md
 */

export const DECISION_CONFIG = {
  baseline: {
    /** Rolling window used for personal normals. */
    windowDays: 28,
    /** Fewer samples than this means "Learning your normal". */
    minSamples: 7,
    /** MAD is multiplied by this to estimate a standard deviation. */
    madScale: 1.4826,
    /** Spread floor so a flat series cannot divide by zero. */
    minSpread: 1,
    /** Weekday-aware spend normal uses this many weeks of the same weekday. */
    weekdayWeeks: 8,
    /** Minimum same-weekday samples before the weekday normal wins. */
    weekdayMinSamples: 4,
  },

  score: {
    weights: {
      sleep: 0.3,
      moneyPace: 0.3,
      commitments: 0.2,
      habits: 0.2,
    },
    /** z is clamped to [-zClamp, +zClamp] before conversion. */
    zClamp: 2,
    /** part = neutral + zFactor * z. */
    neutral: 50,
    zFactor: 25,
    bands: {
      good: 70,
      steady: 40,
    },
  },

  /**
   * Simple fixed targets used while a personal normal is still learning, and
   * for components that have no personal-normal series (commitments).
   * Money is in rupees; sleep is in minutes; rates are 0..1.
   */
  fallback: {
    sleepMinutes: 420,
    dailySpendRupees: 1500,
    habitsDoneRate: 0.7,
    tasksDoneRate: 0.7,
    /** Fixed spreads used with fixed targets (a 1-unit floor would be absurd). */
    sleepSpreadMinutes: 60,
    spendSpreadRupees: 500,
    habitsSpreadRate: 0.15,
    commitmentsDue: 2,
    commitmentsSpread: 2,
    /** A month-over-month pace ratio of 1.0 means on plan. */
    paceSpread: 0.25,
  },

  rules: {
    /** Rule 1 — projected cash below the minimum balance within N days. */
    cashflowHorizonDays: 14,
    /** Rule 2 — a bill within N days could break the minimum balance. */
    billWindowDays: 3,
    /** Rule 3 — month spend pace above this multiple of elapsed time. */
    budgetPace: 1.0,
    /** Rule 4 — slept at least this much under normal, and spend normal high. */
    shortNightMinutes: 60,
    /** Rule 4 — daily spend above this multiple of normal counts as "high". */
    highSpendMultiple: 1.15,
  },
} as const;

export type DecisionConfig = typeof DECISION_CONFIG;
