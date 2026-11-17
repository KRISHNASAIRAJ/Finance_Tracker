// sleepScoring.ts
// Drop-in scoring for inferSleepSession(). Pure functions, no native changes.

export type Bucket = { m: number; v: number; s?: number; o?: number };
export type Sensitivity = 'low' | 'medium' | 'high';
export type MinuteState = 'sleep' | 'awake' | 'unknown';
export type WakeUp = { startMs: number; endMs: number; minutes: number };

export type NightAnalysis = {
  sleepMinutes: number;
  unknownMinutes: number;
  wakeUps: WakeUp[];        // real wake-ups (>= MIN_WAKEUP_MIN)
  microArousals: number;    // short blips merged into sleep
  cutoffUsed: number;
};

export const MIN_WAKEUP_MIN = 5;
export const LONG_WAKEUP_MIN = 15;
const MIN_SLEEP_FRAGMENT_MIN = 3;

// Offsets -4..+2 around the current minute (Cole-Kripke style window).
const OFFSETS = [-4, -3, -2, -1, 0, 1, 2];
const WEIGHTS = [0.1, 0.15, 0.2, 0.3, 0.5, 0.3, 0.15];

// Windowed score is a weighted average of "moving seconds" (0 to 60),
// so cutoffs sit lower than the old per-minute 12/20/30 s thresholds.
// These are starting values. Tune them against a few nights of real data.
export const DEFAULT_CUTOFF: Record<Sensitivity, number> = { low: 9, medium: 6, high: 4 };
const LEGACY_PEAK_THRESHOLD = 0.15; // m/s^2, only for buckets without `s`

function activity(b: Bucket, sens: Sensitivity): number {
  if ((b.o ?? 0) > 0) return 60; // screen on = awake
  if (typeof b.s === 'number') return Math.min(60, b.s);
  const movingSeconds = { low: 30, medium: 20, high: 12 }[sens];
  return b.v >= LEGACY_PEAK_THRESHOLD ? movingSeconds : 0;
}

// Weighted score for minute m. Missing neighbors are skipped and weights
// are renormalized. Returns null if the minute itself is missing.
function windowScore(
  map: Map<number, Bucket>,
  m: number,
  sens: Sensitivity
): number | null {
  if (!map.has(m)) return null;
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < OFFSETS.length; i++) {
    const b = map.get(m + OFFSETS[i]);
    if (!b) continue;
    sum += WEIGHTS[i] * activity(b, sens);
    wSum += WEIGHTS[i];
  }
  return wSum > 0 ? sum / wSum : null;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

// Personal cutoff from recent nights (pass the last 7 nights' buckets).
// Uses the 85th percentile of windowed scores, clamped near the preset so
// one weird night cannot push the cutoff somewhere absurd.
export function personalCutoff(
  recentNights: Bucket[][],
  sens: Sensitivity
): number {
  const base = DEFAULT_CUTOFF[sens];
  const scores: number[] = [];
  for (const night of recentNights) {
    const map = new Map(night.map((b) => [b.m, b] as const));
    for (const b of night) {
      const sc = windowScore(map, b.m, sens);
      if (sc !== null) scores.push(sc);
    }
  }
  if (scores.length < 300) return base; // under ~5 hours of data, not enough
  const p85 = percentile(scores, 0.85);
  const target = p85 * 1.5;
  return Math.min(base * 1.6, Math.max(base * 0.6, target));
}

type Run = { state: MinuteState; from: number; to: number };

function toRuns(states: MinuteState[]): Run[] {
  const out: Run[] = [];
  let i = 0;
  while (i < states.length) {
    let j = i;
    while (j + 1 < states.length && states[j + 1] === states[i]) j++;
    out.push({ state: states[i], from: i, to: j });
    i = j + 1;
  }
  return out;
}

export function analyzeNight(
  buckets: Bucket[],
  bedMin: number,   // epoch minute of bedtime
  wakeMin: number,  // epoch minute of final wake-up
  sens: Sensitivity,
  cutoff: number = DEFAULT_CUTOFF[sens]
): NightAnalysis {
  const map = new Map(buckets.map((b) => [b.m, b] as const));
  const n = wakeMin - bedMin + 1;
  const states: MinuteState[] = new Array(n);
  const screenOn: boolean[] = new Array(n);

  // 1) Classify each minute from its windowed score.
  for (let i = 0; i < n; i++) {
    const m = bedMin + i;
    const b = map.get(m);
    screenOn[i] = !!b && (b.o ?? 0) > 0;
    const sc = windowScore(map, m, sens);
    if (sc === null) states[i] = 'unknown'; // no data, not "still"
    else states[i] = screenOn[i] || sc >= cutoff ? 'awake' : 'sleep';
  }

  let microArousals = 0;

  // 2) Webster-style rescoring.
  const absorbShortAwake = (count: boolean) => {
    for (const r of toRuns(states)) {
      if (r.state !== 'awake') continue;
      const len = r.to - r.from + 1;
      const hasScreen = screenOn.slice(r.from, r.to + 1).some(Boolean);
      if (len < MIN_WAKEUP_MIN && !hasScreen) {
        for (let i = r.from; i <= r.to; i++) states[i] = 'sleep';
        if (count) microArousals++;
      }
    }
  };
  absorbShortAwake(true);

  // Tiny sleep fragments squeezed between awake runs are really awake.
  const runs = toRuns(states);
  for (let k = 1; k < runs.length - 1; k++) {
    const r = runs[k];
    if (
      r.state === 'sleep' &&
      runs[k - 1].state === 'awake' &&
      runs[k + 1].state === 'awake' &&
      r.to - r.from + 1 < MIN_SLEEP_FRAGMENT_MIN
    ) {
      for (let i = r.from; i <= r.to; i++) states[i] = 'awake';
    }
  }
  absorbShortAwake(false); // merged awake runs may now be short; no recount

  // 3) Extract results between first and last sleep minute.
  const first = states.indexOf('sleep');
  const last = states.lastIndexOf('sleep');
  const wakeUps: WakeUp[] = [];
  let sleepMinutes = 0;
  let unknownMinutes = 0;

  if (first !== -1) {
    for (let i = first; i <= last; i++) {
      if (states[i] === 'sleep') sleepMinutes++;
      else if (states[i] === 'unknown') unknownMinutes++;
    }
    for (const r of toRuns(states)) {
      if (r.state !== 'awake' || r.from <= first || r.to >= last) continue;
      const minutes = r.to - r.from + 1;
      wakeUps.push({
        startMs: (bedMin + r.from) * 60000,
        endMs: (bedMin + r.to + 1) * 60000,
        minutes,
      });
    }
  }

  return { sleepMinutes, unknownMinutes, wakeUps, microArousals, cutoffUsed: cutoff };
}
