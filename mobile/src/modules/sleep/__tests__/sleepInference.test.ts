/**
 * Automatic sleep tracking — inference of the sleep session from the
 * accelerometer timeline.
 */
import {
  inferSleepSession,
  motionThreshold,
  inNightWindow,
  minuteOfDay,
  currentStillness,
  type SleepInferenceOptions,
} from '../sleepInference';
import type { MotionBucket } from '../sleepMotion';

const OPTIONS: SleepInferenceOptions = {
  threshold: 0.35,
  sleepStartMin: 21 * 60, // 21:00
  sleepEndMin: 12 * 60, // 12:00
  minSessionMin: 120,
};

/** A Date today at the given local time (dayOffset shifts whole days). */
function at(hour: number, minute = 0, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Build a timeline of `minutes` one-minute buckets starting at `start`.
 * `awake` lists the indexes (relative to the start) that count as movement.
 */
function buildBuckets(
  start: Date,
  minutes: number,
  awake: number[] = [],
  stillValue = 0.05,
  awakeValue = 1.5
): MotionBucket[] {
  const out: MotionBucket[] = [];
  for (let i = 0; i < minutes; i++) {
    const t = start.getTime() + i * 60000;
    out.push({ m: Math.floor(t / 60000), v: awake.includes(i) ? awakeValue : stillValue });
  }
  return out;
}

describe('motionThreshold', () => {
  it('maps the sensitivity to a movement threshold', () => {
    expect(motionThreshold('low')).toBeGreaterThan(motionThreshold('medium'));
    expect(motionThreshold('medium')).toBeGreaterThan(motionThreshold('high'));
  });
});

describe('inNightWindow', () => {
  it('handles a window that does not wrap midnight', () => {
    expect(inNightWindow(22 * 60, 20 * 60, 23 * 60)).toBe(true);
    expect(inNightWindow(12 * 60, 20 * 60, 23 * 60)).toBe(false);
  });

  it('handles a window that wraps midnight', () => {
    expect(inNightWindow(23 * 60, 21 * 60, 12 * 60)).toBe(true);
    expect(inNightWindow(2 * 60, 21 * 60, 12 * 60)).toBe(true);
    expect(inNightWindow(13 * 60, 21 * 60, 12 * 60)).toBe(false);
  });
});

describe('minuteOfDay', () => {
  it('returns the local minutes since midnight', () => {
    expect(minuteOfDay(at(7, 45).getTime())).toBe(7 * 60 + 45);
  });
});

describe('inferSleepSession', () => {
  it('returns null without any data', () => {
    expect(inferSleepSession([], OPTIONS)).toBeNull();
  });

  it('detects a normal night (phone put down at 22:05, picked up at 06:35)', () => {
    // 22:00 → 08:00, movement while putting the phone down and picking it up.
    const buckets = buildBuckets(at(22, 0), 600, [0, 1, 2, 3, 4, 5, 515, 516, 517, 518, 519]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.bedTime).toBe(at(22, 5).getTime());
    expect(result!.wakeTime).toBe(at(6, 35, 1).getTime());
    expect(result!.durationMin).toBe(8 * 60 + 30);
    expect(result!.interruptions).toBe(0);
    expect(result!.confidence).toBeGreaterThan(0.5);
  });

  it('ignores a daytime nap', () => {
    const buckets = buildBuckets(at(14, 0), 180);
    expect(inferSleepSession(buckets, OPTIONS)).toBeNull();
  });

  it('counts a night wake-up but keeps the bedtime', () => {
    // A five minute break at 02:00 in the middle of the night.
    const buckets = buildBuckets(at(22, 0), 600, [
      0, 1, 2, 3, 4, 5,
      240, 241, 242, 243, 244,
      515, 516, 517, 518, 519,
    ]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.bedTime).toBe(at(22, 5).getTime());
    expect(result!.wakeTime).toBe(at(6, 35, 1).getTime());
    expect(result!.interruptions).toBe(1);
  });

  it('rejects a session that is too short', () => {
    const buckets = buildBuckets(at(22, 0), 60);
    expect(inferSleepSession(buckets, OPTIONS)).toBeNull();
  });

  it('ignores movement below the threshold and ends the night above it', () => {
    // A tiny bump (0.3 m/s^2) at 03:00 in the middle of the night.
    const buckets = buildBuckets(at(22, 0), 600, [300], 0.05, 0.3);

    const relaxed = inferSleepSession(buckets, OPTIONS);
    expect(relaxed).not.toBeNull();
    expect(relaxed!.bedTime).toBe(at(22, 0).getTime());
    expect(relaxed!.wakeTime).toBe(at(8, 0, 1).getTime());

    // With a sensitive threshold the bump counts as movement — the night ends
    // there instead.
    const sensitive = inferSleepSession(buckets, { ...OPTIONS, threshold: 0.2 });
    expect(sensitive).not.toBeNull();
    expect(sensitive!.wakeTime).toBe(at(3, 0, 1).getTime());
  });

  it('keeps the wake time at the end of the main sleep stretch', () => {
    // The phone is picked up at 06:35 but then lies still on the bed.
    const buckets = buildBuckets(at(22, 0), 600, [0, 1, 2, 3, 4, 5, 515, 516]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.wakeTime).toBe(at(6, 35, 1).getTime());
  });
});

describe('currentStillness', () => {
  it('measures how long the phone has not moved', () => {
    const buckets = buildBuckets(at(22, 0), 60, [0, 1]);
    const streak = currentStillness(buckets, 0.35);
    expect(streak).not.toBeNull();
    expect(streak!.minutes).toBe(58);
    expect(streak!.sinceMs).toBe(at(22, 2).getTime());
  });

  it('returns null while the phone is moving', () => {
    const buckets = buildBuckets(at(22, 0), 60, [0, 1, 59]);
    expect(currentStillness(buckets, 0.35)).toBeNull();
  });
});
