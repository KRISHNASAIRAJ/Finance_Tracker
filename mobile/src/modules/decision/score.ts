/**
 * Day score (spec §3). Pure, deterministic, 0..100.
 *
 * Every component converts a value-vs-normal comparison into a 0..100 part
 * via a clamped z-score: part = 50 + 25 * z, where z is inverted for
 * "lower is good" metrics (spend, commitments). Missing components are
 * dropped and the remaining weights are re-normalised, and that fact is
 * reported in the result so the UI can say so.
 */

import { computeBaseline } from './baseline';
import { DECISION_CONFIG } from './config';
import type {
  Band,
  ComponentKey,
  DayScore,
  EngineInput,
  ScoreComponent,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function zPart(z: number): number {
  const { zClamp, neutral, zFactor } = DECISION_CONFIG.score;
  return neutral + zFactor * clamp(z, -zClamp, zClamp);
}

export function bandFor(score: number): Band {
  const { good, steady } = DECISION_CONFIG.score.bands;
  if (score >= good) return 'Good';
  if (score >= steady) return 'Steady';
  return 'Low';
}

function buildComponents(input: EngineInput): {
  components: ScoreComponent[];
  missing: ComponentKey[];
  learning: DayScore['learning'];
} {
  const { fallback, score: scoreCfg } = DECISION_CONFIG;
  const components: ScoreComponent[] = [];
  const missing: ComponentKey[] = [];
  const learning: DayScore['learning'] = [];
  const samples = input.samples;

  const add = (
    key: ComponentKey,
    part: number,
    value: number,
    normal: number,
    reason: string
  ) => {
    components.push({
      key,
      score: clamp(Math.round(part), 0, 100),
      baseWeight: DECISION_CONFIG.score.weights[key],
      weight: DECISION_CONFIG.score.weights[key],
      value,
      normal,
      reason,
    });
  };

  // ── Sleep ────────────────────────────────────────────────
  const sleepSamples = samples.sleep ?? [];
  const sleepBase = computeBaseline({
    metric: 'sleep',
    samples: sleepSamples,
    today: input.today,
    fallbackTarget: fallback.sleepMinutes,
  });
  if (input.sleepLastNightMinutes === null && sleepSamples.length === 0) {
    missing.push('sleep');
  } else {
    if (sleepBase.learning) learning.push('sleep');
    const value = input.sleepLastNightMinutes ?? sleepBase.median;
    const spread = sleepBase.learning
      ? fallback.sleepSpreadMinutes
      : sleepBase.spread;
    const z = (value - sleepBase.median) / spread;
    add(
      'sleep',
      zPart(z),
      value,
      sleepBase.median,
      sleepBase.learning
        ? 'Compared with the 7-hour target while your normal is still learning.'
        : `Last night vs your ${Math.round(sleepBase.median)} min normal.`
    );
  }

  // ── Money pace ───────────────────────────────────────────
  const spendSamples = samples.spend ?? [];
  const spendBase = computeBaseline({
    metric: 'spend',
    samples: spendSamples,
    today: input.today,
    fallbackTarget: fallback.dailySpendRupees,
    weekdayAware: true,
  });
  const parts: number[] = [];
  if (input.budgetPace !== null) {
    const z = -(input.budgetPace - 1) / fallback.paceSpread;
    parts.push(zPart(z));
  }
  if (input.dailySpendRupees !== null || spendSamples.length > 0) {
    if (spendBase.learning) learning.push('spend');
    const value = input.dailySpendRupees ?? spendBase.median;
    const spread = spendBase.learning
      ? fallback.spendSpreadRupees
      : spendBase.spread;
    const z = (spendBase.median - value) / spread;
    parts.push(zPart(z));
  }
  if (parts.length === 0) {
    missing.push('moneyPace');
  } else {
    const part = parts.reduce((a, b) => a + b, 0) / parts.length;
    const value = input.dailySpendRupees ?? spendBase.median;
    add(
      'moneyPace',
      part,
      value,
      spendBase.median,
      spendBase.learning
        ? 'Spend pace vs a fixed target while your normal is still learning.'
        : `Today's spend vs your ₹${Math.round(spendBase.median)} normal.`
    );
  }

  // ── Commitments ──────────────────────────────────────────
  const due = input.tasksDueToday + input.billsDueSoon;
  const dueZ =
    (fallback.commitmentsDue - due) / fallback.commitmentsSpread;
  add(
    'commitments',
    zPart(dueZ),
    due,
    fallback.commitmentsDue,
    `${due} task${due === 1 ? '' : 's'} due today and bills in 3 days.`
  );

  // ── Habits ───────────────────────────────────────────────
  const habitSamples = samples.habits ?? [];
  const habitBase = computeBaseline({
    metric: 'habits',
    samples: habitSamples,
    today: input.today,
    fallbackTarget: fallback.habitsDoneRate,
  });
  if (input.habitsYesterdayRate === null && habitSamples.length === 0) {
    missing.push('habits');
  } else {
    if (habitBase.learning) learning.push('habits');
    const value = input.habitsYesterdayRate ?? habitBase.median;
    const spread = habitBase.learning
      ? fallback.habitsSpreadRate
      : habitBase.spread;
    const z = (value - habitBase.median) / spread;
    add(
      'habits',
      zPart(z),
      value,
      habitBase.median,
      habitBase.learning
        ? 'Yesterday vs the 70% target while your normal is still learning.'
        : `Yesterday's habits vs your ${Math.round(habitBase.median * 100)}% normal.`
    );
  }

  return { components, missing, learning };
}

export function computeDayScore(input: EngineInput): DayScore {
  const { components, missing, learning } = buildComponents(input);

  // Re-weight: drop missing components, normalise the rest to sum 1.
  const kept = components.filter((c) => !missing.includes(c.key));
  const keptWeight = kept.reduce((sum, c) => sum + c.baseWeight, 0);
  for (const c of components) {
    c.weight = keptWeight > 0 ? c.baseWeight / keptWeight : 0;
  }

  const total = kept.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score =
    kept.length === 0 ? DECISION_CONFIG.score.neutral : clamp(Math.round(total), 0, 100);

  return {
    date: input.today,
    score,
    band: bandFor(score),
    components,
    missing,
    learning,
  };
}

/** Human-readable weights, shared by the "How this is calculated" sheet. */
export function displayWeights(): Array<{ key: ComponentKey; label: string; weight: number }> {
  return [
    { key: 'sleep', label: 'Sleep', weight: scoreCfgWeight('sleep') },
    { key: 'moneyPace', label: 'Money pace', weight: scoreCfgWeight('moneyPace') },
    { key: 'commitments', label: 'Commitments', weight: scoreCfgWeight('commitments') },
    { key: 'habits', label: 'Habits', weight: scoreCfgWeight('habits') },
  ];
}

function scoreCfgWeight(key: ComponentKey): number {
  return DECISION_CONFIG.score.weights[key];
}
