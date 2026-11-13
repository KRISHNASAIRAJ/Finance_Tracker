/**
 * sleepScore — the 0–100 score.
 */
import { sleepScore, DEFAULT_TARGET_MIN } from '../sleepScore';

describe('sleepScore', () => {
  it('is zero without a night', () => {
    expect(sleepScore({ durationMin: 0, deepMin: 0, interruptions: 0 })).toBe(0);
  });

  it('gives a full score for a long, deep and uninterrupted night', () => {
    const score = sleepScore({
      durationMin: 480,
      deepMin: 120, // 25 % deep
      interruptions: 0,
    });
    expect(score).toBe(100);
  });

  it('drops the points for a short night', () => {
    const short = sleepScore({ durationMin: 240, deepMin: 60, interruptions: 0 });
    const long = sleepScore({ durationMin: 480, deepMin: 120, interruptions: 0 });
    expect(short).toBeLessThan(long);
  });

  it('drops the points for the wake-ups', () => {
    const calm = sleepScore({ durationMin: 480, deepMin: 120, interruptions: 0 });
    const restless = sleepScore({ durationMin: 480, deepMin: 120, interruptions: 5 });
    expect(restless).toBeLessThan(calm);
    expect(restless).toBe(calm - 20);
  });

  it('drops the points when there is no deep sleep', () => {
    const noDeep = sleepScore({ durationMin: 480, deepMin: 0, interruptions: 0 });
    const deep = sleepScore({ durationMin: 480, deepMin: 120, interruptions: 0 });
    expect(noDeep).toBe(deep - 30);
  });

  it('never goes above 100 or below 0', () => {
    expect(
      sleepScore({ durationMin: 9999, deepMin: 9999, interruptions: 0 })
    ).toBe(100);
    expect(sleepScore({ durationMin: 1, deepMin: 0, interruptions: 99 })).toBe(0);
  });

  it('uses the default target', () => {
    const score = sleepScore({
      durationMin: DEFAULT_TARGET_MIN,
      deepMin: DEFAULT_TARGET_MIN * 0.2,
      interruptions: 0,
    });
    expect(score).toBe(100);
  });
});
