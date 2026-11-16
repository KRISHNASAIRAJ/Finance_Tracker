import { bandFor, computeDayScore, displayWeights } from '../score';
import { DECISION_CONFIG } from '../config';
import { makeInput } from './fixture';

describe('day score', () => {
  test('bands follow the config thresholds', () => {
    expect(bandFor(70)).toBe('Good');
    expect(bandFor(40)).toBe('Steady');
    expect(bandFor(39)).toBe('Low');
  });

  test('weights are read from config, not hardcoded', () => {
    const weights = displayWeights();
    expect(weights.find((w) => w.key === 'sleep')?.weight).toBe(
      DECISION_CONFIG.score.weights.sleep
    );
  });

  test('every component present: weights sum to 1 and score is in range', () => {
    const score = computeDayScore(makeInput());
    expect(score.missing).toEqual([]);
    expect(score.components).toHaveLength(4);
    const sum = score.components.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  test('missing sleep is dropped and the rest are re-weighted', () => {
    const score = computeDayScore(
      makeInput({ sleepLastNightMinutes: null, samples: {} })
    );
    expect(score.missing).toContain('sleep');
    expect(score.components.find((c) => c.key === 'sleep')).toBeUndefined();
    const sum = score.components.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  test('fewer than 7 days marks the metric as learning', () => {
    const score = computeDayScore(
      makeInput({
        samples: {
          sleep: [
            { day: '2026-11-15', value: 400 },
            { day: '2026-11-14', value: 410 },
          ],
        },
      })
    );
    expect(score.learning).toContain('sleep');
  });

  test('better sleep and lower spend raise the score', () => {
    const base = computeDayScore(makeInput());
    const better = computeDayScore(
      makeInput({ sleepLastNightMinutes: 520, dailySpendRupees: 400 })
    );
    expect(better.score).toBeGreaterThan(base.score);
  });
});
