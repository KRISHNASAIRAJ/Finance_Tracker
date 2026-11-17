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
  nightAbsoluteMinute,
  minuteOfDay,
  nightKeyForMinute,
  currentStillness,
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

describe('nightAbsoluteMinute', () => {
  const START = 21 * 60 + 30; // 21:30
  const END = 9 * 60 + 30; // 09:30 (next day)

  it('puts the evening and the morning on one increasing timeline', () => {
    const abs = (m: number) => nightAbsoluteMinute(m, START, END);
    expect(abs(21 * 60 + 39)).toBe(21 * 60 + 39); // evening keeps its value
    expect(abs(23 * 60 + 59)).toBe(23 * 60 + 59);
    expect(abs(2 * 60)).toBe(2 * 60 + 1440); // after midnight = next day
    expect(abs(6 * 60 + 45)).toBe(6 * 60 + 45 + 1440);
    expect(abs(6 * 60 + 45)).toBeGreaterThan(abs(23 * 60 + 59));
  });

  it('leaves a window that does not cross midnight alone', () => {
    expect(nightAbsoluteMinute(22 * 60, 20 * 60, 23 * 60)).toBe(22 * 60);
  });
});

describe('inOrAfterWakeStart', () => {
  // The production night window — it wraps midnight.
  const START = 21 * 60 + 30;
  const END = 9 * 60 + 30;
  const wake = (m: number) => inOrAfterWakeStart(m, 6 * 60 + 30, 7 * 60, START, END);

  it('is true from the wake window on', () => {
    expect(wake(6 * 60 + 45)).toBe(true);
    expect(wake(9 * 60)).toBe(true);
  });

  it('is false in the small hours before the wake window', () => {
    expect(wake(3 * 60)).toBe(false);
  });

  it('is false for EVERY evening minute — the night has only just begun', () => {
    // Regression: the old linear comparison made 22:39 (1359) look "after" the
    // 06:30 wake start (390), so a short evening break ended the night.
    expect(wake(21 * 60 + 39)).toBe(false);
    expect(wake(22 * 60 + 39)).toBe(false);
    expect(wake(23 * 60 + 59)).toBe(false);
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

  it('absorbs a one-minute blip as a micro-arousal, not a wake-up', () => {
    // A single legacy bump is too short to clear the 5-minute wake-up floor:
    // the windowed scorer absorbs it into sleep and counts a micro-arousal.
    const buckets = buildBuckets(at(22, 0), 600, [300], 0.05, 0.3);
    const sensitive = inferSleepSession(buckets, { ...OPTIONS, threshold: 0.2 });
    expect(sensitive).not.toBeNull();
    expect(sensitive!.wakeTime).toBe(at(7, 0, 1).getTime());
    expect(sensitive!.interruptions).toBe(0);
    expect(sensitive!.microArousals).toBeGreaterThanOrEqual(1);
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

  it('remembers a 7-minute wake-up instead of asking the user', () => {
    const buckets = buildMovingBuckets(at(22, 0), 600, [240, 241, 242, 243, 244, 245, 246]);
    const result = inferSleepSession(buckets, OPTIONS);
    expect(result).not.toBeNull();
    expect(result!.interruptions).toBe(1);
    expect(result!.wakeUps).toHaveLength(1);
    // The -4..+2 window spreads a 7-minute awake run to ~12 minutes and pulls
    // its start ~2 minutes earlier. That is expected from the windowed scorer.
    expect(result!.wakeUps[0].minutes).toBe(12);
    expect(result!.wakeUps[0].startMs).toBe(at(1, 58, 1).getTime());
    // The night still ends in the morning, not at the wake-up.
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime());
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
    expect(result!.wakeUps).toHaveLength(1);
    expect(result!.wakeUps[0].minutes).toBe(17);
    expect(result!.wakeUps[0].startMs).toBe(at(1, 58, 1).getTime());
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
    expect(result!.wakeUps).toHaveLength(1);
    expect(result!.wakeUps[0].minutes).toBe(50);
    expect(result!.wakeUps[0].startMs).toBe(at(1, 58, 1).getTime());
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

/** "Going to bed" must start tracking — and the logged night — at the tap. */
describe('manual bedtime anchor (Going to bed)', () => {
  it('anchors bedtime to the tap even before the night window opens', () => {
    // Bed at 20:00 (window opens 21:30), phone put down at 20:30, up at 07:00.
    // Without the anchor the bedtime would be pushed to 21:30 by the window
    // clipping and the first 90 minutes would be lost.
    const bedMs = at(20, 0).getTime();
    const buckets = buildBuckets(at(20, 30), 631); // 20:30 → 07:00, all still
    const result = inferSleepSession(buckets, { ...REAL_WINDOW, manualBedtimeMs: bedMs });
    expect(result).not.toBeNull();
    expect(result!.bedTime).toBe(bedMs);
    expect(result!.wakeTime).toBe(at(7, 0, 1).getTime()); // 07:00 the next day
    expect(result!.durationMin).toBe(11 * 60);
  });

  it('does not extend an implausible span just because a bedtime was tapped', () => {
    // A confirmed bedtime at 08:32 with the phone still until 22:31 is still a
    // nonsensical ~14 h "sleep" — the motion-derived night must fail first, so
    // the anchor can never resurrect the old bug.
    const buckets = buildBuckets(at(8, 32), 840);
    expect(
      inferSleepSession(buckets, { ...REAL_WINDOW, manualBedtimeMs: at(8, 32).getTime() })
    ).toBeNull();
  });

  it('keeps inferring a bedtime from motion when no bedtime was tapped', () => {
    const buckets = buildBuckets(at(23, 0, -1), 480); // 23:00 → 06:59
    const result = inferSleepSession(buckets, REAL_WINDOW);
    expect(result!.bedTime).toBe(at(23, 0, -1).getTime());
  });
});

/**
 * Regression: a short break in the EVENING must never end the night.
 *
 * The user's report: "it started at 9:39 PM and at 10:39 PM it ended like
 * morning". A one-minute wake-up at 22:39 was fed to the wake detector, whose
 * linear minute-of-day comparison (1359 >= wakeStart 390) called it "morning"
 * and logged a 60-minute night — accepted by the hourly live backup (min 30
 * min) even though the full auto-save path would reject it (min 120 min).
 */
describe('evening breaks belong to the night', () => {
  // 21:39 phone put down; index 60 = 22:39 (the break); 561-565 = 07:00-07:04.
  const bed = at(21, 39);
  const indices = (...extra: number[]) => [0, ...extra, 561, 562, 563, 564, 565];
  const buckets = (awake: number[]) => buildMovingBuckets(bed, 566, awake);

  it('counts a one-minute evening break as an interruption and keeps sleeping', () => {
    const result = inferSleepSession(buckets(indices(60)), REAL_WINDOW);
    expect(result).not.toBeNull();
    expect(result!.bedTime).toBe(bed.getTime());
    // The night ends at the real morning pick-up, NOT at 22:39.
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
    expect(result!.durationMin).toBe(9 * 60 + 20);
    expect(result!.interruptions).toBe(1);
  });

  it('does the same for the live-backup threshold (min 30 min)', () => {
    // Mirrors sleepLiveSync, which accepts partial nights from 30 minutes.
    const result = inferSleepSession(buckets(indices(60)), {
      ...REAL_WINDOW,
      minSessionMin: 30,
    });
    expect(result).not.toBeNull();
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
    expect(result!.durationMin).toBeGreaterThan(8 * 60);
  });

  it('remembers a 10-minute evening break and keeps sleeping', () => {
    const break10 = Array.from({ length: 10 }, (_, i) => 60 + i); // 22:39-22:48
    const result = inferSleepSession(buckets(indices(...break10)), REAL_WINDOW);
    expect(result).not.toBeNull();
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
    expect(result!.interruptions).toBe(1);
    expect(result!.wakeUps).toHaveLength(1);
    expect(result!.wakeUps[0].minutes).toBe(15);
    expect(result!.wakeUps[0].startMs).toBe(at(22, 37).getTime());
  });

  it('still ends the night at a real movement in the morning wake window', () => {
    const result = inferSleepSession(buckets(indices(60)), REAL_WINDOW);
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
    // A movement at 06:45 (index 546) is the wake-up.
    const late = buildMovingBuckets(bed, 566, [0, 60, 546, 547]);
    const withLate = inferSleepSession(late, REAL_WINDOW);
    expect(withLate!.wakeTime).toBe(at(6, 45, 1).getTime());
  });

  it('keeps the manual "Going to bed" anchor with an evening break', () => {
    const result = inferSleepSession(buckets(indices(60)), {
      ...REAL_WINDOW,
      manualBedtimeMs: bed.getTime(),
    });
    expect(result!.bedTime).toBe(bed.getTime());
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
  });
});

/** The "remember it" data: every gap is kept with its own length and time. */
describe('wake-up details', () => {
  const bed = at(21, 39);
  // A 3-minute break at 22:39 (i=60) and a 22-minute break at 02:00 (i=261).
  const awake = [
    0,
    60, 61, 62,
    ...Array.from({ length: 22 }, (_, i) => 261 + i),
    561, 562, 563, 564, 565,
  ];

  it('records both wake-ups with minutes and start times', () => {
    const result = inferSleepSession(buildMovingBuckets(bed, 566, awake), REAL_WINDOW);
    expect(result).not.toBeNull();
    expect(result!.interruptions).toBe(2);
    expect(result!.wakeUps).toHaveLength(2);
    // The windowed score spreads each awake run, so lengths are >= the raw
    // break and start times can be a couple of minutes earlier.
    expect(result!.wakeUps[0].minutes).toBeGreaterThanOrEqual(3);
    expect(result!.wakeUps[1].minutes).toBeGreaterThanOrEqual(22);
    expect(result!.wakeUps[0].startMs).toBeLessThanOrEqual(at(22, 39).getTime());
    expect(result!.wakeUps[1].startMs).toBeLessThanOrEqual(at(2, 0, 1).getTime());
    // The new scoring metadata is always present for tuning.
    expect(result!.cutoffUsed).toBeGreaterThan(0);
    expect(result!.sleepMinutes).toBeGreaterThan(0);
    expect(result!.unknownMinutes).toBe(0);
    expect(typeof result!.microArousals).toBe('number');
    // Neither break ended the night.
    expect(result!.wakeTime).toBe(at(6, 59, 1).getTime());
  });

  it('lets a gap over 15 minutes be recognised as a long wake-up', () => {
    const result = inferSleepSession(buildMovingBuckets(bed, 566, awake), REAL_WINDOW);
    expect(result!.wakeUps.some((w) => w.minutes > 15)).toBe(true);
  });
});
