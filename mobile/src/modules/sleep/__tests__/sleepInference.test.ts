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
  nightKeyForMinute,
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

  it('keeps the night going at a gap of more than 10 minutes (long interruption)', () => {
    // A twelve-minute phone check at 02:00 — the user went back to bed at
    // 02:12 and slept until the wake window. The night must not end there.
    const buckets = buildMovingBuckets(
      at(22, 0),
      600,
      Array.from({ length: 12 }, (_, i) => 240 + i)
    );
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.pendingGap).toBeNull();
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(result!.interruptions).toBe(1);
  });

  it('keeps the night going at a 45 minute mid-night wake-up', () => {
    // 02:00–02:45 awake, back to sleep until the wake window.
    const buckets = buildMovingBuckets(
      at(22, 0),
      600,
      Array.from({ length: 45 }, (_, i) => 240 + i)
    );
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.pendingGap).toBeNull();
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(result!.interruptions).toBe(1);
  });

  it('ends the night at a gap longer than the interruption cap', () => {
    // Awake from 02:00 to 05:00 — a real get-up, not a phone check.
    const buckets = buildMovingBuckets(
      at(22, 0),
      600,
      Array.from({ length: 180 }, (_, i) => 240 + i)
    );
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    // The night that is reported is the stretch before the long get-up.
    expect(result!.bedTime).toBe(at(22, 0).getTime());
    expect(result!.wakeTime).toBe(at(1, 59, 1).getTime());
  });

  it('does not count a short rest before the real sleep as bedtime', () => {
    // 22:55–23:09 still (resting with the phone, screen off), 23:10 moving,
    // then asleep until 07:00, phone picked up at 07:00.
    const start = at(22, 55);
    const awake = [15, 16, 17, 490, 491, 492];
    const buckets = buildMovingBuckets(start, 495, awake);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.bedTime).toBe(at(23, 12).getTime());
  });

  it('treats a minute with the screen interactive as awake, even without movement', () => {
    // 22:00 → 08:00. The phone never moves, but the screen is on at 02:00–02:12.
    const buckets = buildMovingBuckets(at(22, 0), 600, []);
    for (let i = 240; i <= 251; i += 1) {
      buckets[i] = { ...buckets[i], o: 60 };
    }
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    // A screen-on stretch is a wake-up; the night continues afterwards.
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(result!.interruptions).toBe(1);
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

/** Production night window — the regression below happened with this one. */
const REAL_WINDOW: SleepInferenceOptions = {
  ...OPTIONS,
  sleepStartMin: 21 * 60 + 30, // 21:30
  sleepEndMin: 9 * 60 + 30, // 09:30
};

describe('night grouping (daytime must never become sleep)', () => {
  it('assigns daytime buckets to no night and post-midnight ones to the previous night', () => {
    expect(nightKeyForMinute(Math.floor(at(14, 0).getTime() / 60000), 21 * 60 + 30, 9 * 60 + 30)).toBeNull();
    const evening = nightKeyForMinute(Math.floor(at(22, 0).getTime() / 60000), 21 * 60 + 30, 9 * 60 + 30);
    const afterMidnight = nightKeyForMinute(Math.floor(at(2, 0, 1).getTime() / 60000), 21 * 60 + 30, 9 * 60 + 30);
    expect(afterMidnight).toBe(evening);
  });

  it('rejects a long morning still stretch as a bed time', () => {
    // 07:00–09:30 is 150 still minutes inside the window tail — long enough
    // to pass the duration minimum, but it is not sleep onset.
    const buckets = buildBuckets(at(7, 0), 150);
    expect(inferSleepSession(buckets, REAL_WINDOW)).toBeNull();
  });

  it('rejects the 8:32 am → 10:31 pm "13h 59m" false session', () => {
    // Phone left still on a desk from mid-morning until late evening. The old
    // whole-buffer inference merged the night-window tail (08:32–09:30) with
    // the next evening (21:30–22:31) into one fictitious ~14 h night.
    const buckets = buildBuckets(at(8, 32), 840); // 08:32 → 22:31, all still
    expect(inferSleepSession(buckets, REAL_WINDOW)).toBeNull();
  });

  it('still detects a real night when a still evening follows it', () => {
    // Yesterday 23:00 → today 07:00 is a real night; today 21:30 → 22:31 is
    // just the phone lying on the desk. The latest night yields no session, so
    // inference must fall through to the real one instead of merging them.
    const night = buildBuckets(at(23, 0, -1), 480); // 23:00 → 07:00
    const evening = buildBuckets(at(21, 30), 62); // 21:30 → 22:31
    const result = inferSleepSession([...evening, ...night], REAL_WINDOW);
    expect(result).not.toBeNull();
    // The last bucket is 06:59 (a 480-minute timeline from 23:00 ends there),
    // so the night is 23:00 → 06:59, not 23:00 → 07:00.
    expect(result!.bedTime).toBe(at(23, 0, -1).getTime());
    expect(result!.wakeTime).toBe(at(6, 59).getTime());
    expect(result!.durationMin).toBe(8 * 60 - 1);
  });
});
