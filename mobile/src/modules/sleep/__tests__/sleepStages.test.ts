/**
 * sleepStages — the DEEP / LIGHT / AWAKE lanes.
 */
import { stageOptionsFor, stagePerMinute, stageSegments, DEEP_RUN_MIN } from '../sleepStages';

const options = { threshold: 0.35, movingSeconds: 20 };

/** A bucket: the peak movement and the sustained seconds. */
function bucket(minute: number, moving: boolean, sustained = moving ? 30 : 0) {
  return { m: minute, v: moving ? 1.2 : 0.02, s: sustained };
}

describe('stagePerMinute', () => {
  it('marks the minutes with sustained movement as awake', () => {
    const buckets = [bucket(0, false), bucket(1, true), bucket(2, false)];
    const stages = stagePerMinute(buckets, 0, 3, options);
    expect(stages[0]).toBe('light');
    expect(stages[1]).toBe('awake');
    expect(stages[2]).toBe('light');
  });

  it('marks a long still run as deep sleep', () => {
    const buckets = Array.from({ length: 40 }, (_, i) => bucket(i, false));
    const stages = stagePerMinute(buckets, 0, 40, options);
    expect(stages[0]).toBe('deep');
    expect(stages[DEEP_RUN_MIN - 1]).toBe('deep');
    expect(stages[DEEP_RUN_MIN]).toBe('deep');
  });

  it('keeps a short still run light', () => {
    const buckets = Array.from({ length: 10 }, (_, i) => bucket(i, false));
    const stages = stagePerMinute(buckets, 0, 10, options);
    expect(stages.every((s) => s === 'light')).toBe(true);
  });

  it('falls back to the peak movement for the old buckets', () => {
    // No sustained counter (s = -1) — the peak movement decides.
    const buckets = [
      { m: 0, v: 0.02, s: -1 },
      { m: 1, v: 1.2, s: -1 },
    ];
    const stages = stagePerMinute(buckets, 0, 2, options);
    expect(stages[1]).toBe('awake');
  });
});

describe('stageSegments', () => {
  it('merges the minutes into one bar per stretch', () => {
    const buckets = [
      ...Array.from({ length: 25 }, (_, i) => bucket(i, false)), // deep
      bucket(25, true), // awake
      ...Array.from({ length: 10 }, (_, i) => bucket(26 + i, false)), // light
    ];
    const segments = stageSegments(buckets, 0, 36, options);
    expect(segments.length).toBe(3);
    expect(segments[0].stage).toBe('deep');
    expect(segments[1].stage).toBe('awake');
    expect(segments[2].stage).toBe('light');
  });

  it('expresses the bars as a fraction of the night', () => {
    const buckets = Array.from({ length: 20 }, (_, i) => bucket(i, false));
    const segments = stageSegments(buckets, 0, 20, options);
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBe(0);
    expect(segments[0].len).toBeCloseTo(1, 5);
  });
});

describe('stageOptionsFor', () => {
  it('maps the sensitivity to the thresholds', () => {
    expect(stageOptionsFor('medium').movingSeconds).toBe(20);
    expect(stageOptionsFor('medium').threshold).toBeCloseTo(0.35, 5);
  });
});
