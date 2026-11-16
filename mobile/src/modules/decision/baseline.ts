/**
 * Personal baselines — rolling median + MAD-based spread (spec §2).
 *
 * Pure functions. No store access, no side effects. A baseline with fewer
 * than `minSamples` samples is marked `learning` and carries a fixed target
 * supplied by the caller, so screens can say "Learning your normal" instead
 * of pretending the number is trustworthy.
 */

import { DECISION_CONFIG } from './config';
import { weekdayOf, withinLastDays } from './day';
import type { Baseline, Metric, Sample } from './types';

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Median absolute deviation, scaled to a standard-deviation-like spread. */
export function spread(values: number[]): number {
  if (values.length === 0) return DECISION_CONFIG.baseline.minSpread;
  const mid = median(values);
  const deviations = values.map((v) => Math.abs(v - mid));
  const mad = median(deviations) * DECISION_CONFIG.baseline.madScale;
  return Math.max(DECISION_CONFIG.baseline.minSpread, mad);
}

export interface BaselineOptions {
  metric: Metric;
  samples: Sample[];
  today: string;
  /** Fixed target used while learning. */
  fallbackTarget: number;
  /** Use the same weekday over 8 weeks when there are enough samples. */
  weekdayAware?: boolean;
}

/**
 * Compute one personal normal.
 *
 * Spend normals prefer the same weekday over the last 8 weeks when at least
 * `weekdayMinSamples` such samples exist; otherwise the overall 28-day
 * window is used.
 */
export function computeBaseline({
  metric,
  samples,
  today,
  fallbackTarget,
  weekdayAware = false,
}: BaselineOptions): Baseline {
  const cfg = DECISION_CONFIG.baseline;
  const inWindow = samples.filter((s) => withinLastDays(s.day, today, cfg.windowDays));
  const values = inWindow.map((s) => s.value);

  // The weekday series spans up to 8 weeks (spec §2), not the 28-day overall
  // window — that is how four same-weekday samples can exist.
  const weekdayWindow = cfg.weekdayWeeks * 7;
  const targetWeekday = weekdayOf(today);
  const sameWeekday = samples
    .filter((s) => withinLastDays(s.day, today, weekdayWindow))
    .filter((s) => weekdayOf(s.day) === targetWeekday)
    .map((s) => s.value);
  const useWeekday =
    weekdayAware && sameWeekday.length >= cfg.weekdayMinSamples;

  const chosen = useWeekday ? sameWeekday : values;
  const learning = chosen.length < cfg.minSamples;

  return {
    metric,
    windowDays: cfg.windowDays,
    median: chosen.length > 0 ? median(chosen) : fallbackTarget,
    spread: chosen.length > 0 ? spread(chosen) : cfg.minSpread,
    sampleN: chosen.length,
    learning,
    weekdayAware: useWeekday,
  };
}
