/**
 * Automatic sleep tracking — inference of the sleep session from the
 * accelerometer timeline.
 */
import {
  inferSleepSession,
  motionThreshold,
  movingSecondsThreshold,
  inNightWindow,
  inOrAfterWakeStart,
  minuteOfDay,
  currentStillness,
  resolvePendingGap,
  type SleepInferenceOptions,
} from '../sleepInference';
import type { MotionBucket } from '../sleepMotion';

const OPTIONS: SleepInferenceOptions = {
  threshold: 0.35,
  sleepStartMin: 21 * 60, // 21:00
  sleepEndMin: 12 * 60, // 12:00
  minSessionMin: 120,
  wakeStartMin: 6 * 60 + 30, // 06:30
  wakeEndMin: 7 * 60, // 07:00
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

/**
 * The same timeline, but with the sustained-movement counter the native
 * tracker records (the phone can sit under a pillow).
 */
function buildMovingBuckets(
  start: Date,
  minutes: number,
  awake: number[] = [],
  movingSeconds = 60
): MotionBucket[] {
  const out: MotionBucket[] = [];
  for (let i = 0; i < minutes; i++) {
    const t = start.getTime() + i * 60000;
    const isAwake = awake.includes(i);
    out.push({
      m: Math.floor(t / 60000),
      v: isAwake ? 1.5 : 0.05,
      s: isAwake ? movingSeconds : 0,
    });
  }
  return out;
}

describe('motionThreshold', () => {
  it('maps the sensitivity to a movement threshold', () => {
    expect(motionThreshold('low')).toBeGreaterThan(motionThreshold('medium'));
    expect(motionThreshold('medium')).toBeGreaterThan(motionThreshold('high'));
  });
});

describe('movingSecondsThreshold', () => {
  it('maps the sensitivity to the sustained movement needed to wake up', () => {
    expect(movingSecondsThreshold('low')).toBeGreaterThan(movingSecondsThreshold('medium'));
    expect(movingSecondsThreshold('medium')).toBeGreaterThan(movingSecondsThreshold('high'));
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

describe('inOrAfterWakeStart', () => {
  it('is true from the wake window on', () => {
    expect(inOrAfterWakeStart(6 * 60 + 45, 6 * 60 + 30, 7 * 60)).toBe(true);
    expect(inOrAfterWakeStart(9 * 60, 6 * 60 + 30, 7 * 60)).toBe(true);
    expect(inOrAfterWakeStart(3 * 60, 6 * 60 + 30, 7 * 60)).toBe(false);
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

  it('ignores movement below the threshold', () => {
    // A tiny bump (0.3 m/s^2) at 03:00 in the middle of the night.
    const buckets = buildBuckets(at(22, 0), 600, [300], 0.05, 0.3);

    const relaxed = inferSleepSession(buckets, OPTIONS);
    expect(relaxed).not.toBeNull();
    expect(relaxed!.bedTime).toBe(at(22, 0).getTime());
    // Nobody touched the phone, so the night lasts until the wake window ends.
    expect(relaxed!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(relaxed!.interruptions).toBe(0);
  });

  it('treats a short movement in the middle of the night as an interruption', () => {
    // With a sensitive threshold the bump counts as movement — but a one
    // minute gap is an interruption, the night goes on.
    const buckets = buildBuckets(at(22, 0), 600, [300], 0.05, 0.3);
    const sensitive = inferSleepSession(buckets, { ...OPTIONS, threshold: 0.2 });
    expect(sensitive).not.toBeNull();
    expect(sensitive!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(sensitive!.interruptions).toBe(1);
  });

  it('keeps the wake time at the end of the main sleep stretch', () => {
    // The phone is picked up at 06:35 but then lies still on the bed.
    const buckets = buildBuckets(at(22, 0), 600, [0, 1, 2, 3, 4, 5, 515, 516]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.wakeTime).toBe(at(6, 35, 1).getTime());
  });

  // --- pillow friendly (the sustained-movement counter) --------------------

  it('ignores a short bump when the phone is under a pillow', () => {
    // A single bump of 10 seconds is not a wake-up.
    const buckets = buildMovingBuckets(at(22, 0), 600, [300], 10);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.interruptions).toBe(0);
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
  });

  it('counts sustained movement as a wake-up', () => {
    const buckets = buildMovingBuckets(at(22, 0), 600, [300], 60);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.interruptions).toBe(1);
  });

  it('counts a two minute phone check as an interruption and keeps the night', () => {
    // The user wakes up, looks at the phone for two minutes and goes back to
    // sleep — the night must not end there.
    const buckets = buildMovingBuckets(at(22, 0), 600, [240, 241]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.interruptions).toBe(1);
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(result!.durationMin).toBe(9 * 60);
  });

  // --- the interruption rules ---------------------------------------------

  it('asks the user about a gap of 5 to 10 minutes', () => {
    const buckets = buildMovingBuckets(at(22, 0), 600, [240, 241, 242, 243, 244, 245, 246]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.pendingGap).not.toBeNull();
    expect(result!.pendingGap!.minutes).toBe(7);
    expect(result!.pendingGap!.startMs).toBe(at(2, 0, 1).getTime());
  });

  it('ends the night at a gap of more than 10 minutes', () => {
    const buckets = buildMovingBuckets(
      at(22, 0),
      600,
      Array.from({ length: 12 }, (_, i) => 240 + i)
    );
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.pendingGap).toBeNull();
    expect(result!.wakeTime).toBe(at(2, 0, 1).getTime());
  });
});

describe('resolvePendingGap', () => {
  const session = {
    bedTime: at(22, 0).getTime(),
    wakeTime: at(7, 0, 1).getTime(),
    interruptions: 1,
    durationMin: 9 * 60,
    confidence: 0.8,
    pendingGap: {
      startMs: at(2, 0, 1).getTime(),
      endMs: at(2, 7, 1).getTime(),
      minutes: 7,
    },
  };

  it('ends the night at the gap when the user says the sleep ended there', () => {
    const resolved = resolvePendingGap(session, 'ended');
    expect(resolved.wakeTime).toBe(at(2, 0, 1).getTime());
    expect(resolved.durationMin).toBe(4 * 60);
    expect(resolved.pendingGap).toBeNull();
    expect(resolved.interruptions).toBe(1);
  });

  it('takes the awake time out of the sleep for a long interruption', () => {
    const resolved = resolvePendingGap(session, 'interruption', 12);
    expect(resolved.durationMin).toBe(9 * 60 - 12);
    expect(resolved.interruptions).toBe(2);
    expect(resolved.pendingGap).toBeNull();
  });

  it('uses the detected gap length when no time is given', () => {
    const resolved = resolvePendingGap(session, 'interruption');
    expect(resolved.durationMin).toBe(9 * 60 - 7);
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

  it('uses the sustained-movement counter when it is available', () => {
    // The phone moved for 10 seconds in the last minute — not a wake-up.
    const buckets = buildMovingBuckets(at(22, 0), 60, [59], 10);
    const streak = currentStillness(buckets, 0.35);
    expect(streak).not.toBeNull();
    expect(streak!.minutes).toBe(60);
  });
});
