import { computeBaseline, median, spread } from '../baseline';
import { DECISION_CONFIG } from '../config';

describe('baseline', () => {
  test('median of odd and even series', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 2, 8, 6])).toBe(5);
    expect(median([])).toBe(0);
  });

  test('spread is MAD scaled and floored', () => {
    // Flat series -> floor, never zero (no division by zero downstream).
    expect(spread([10, 10, 10, 10])).toBe(DECISION_CONFIG.baseline.minSpread);
    expect(spread([1, 2, 3, 4, 5])).toBeGreaterThan(DECISION_CONFIG.baseline.minSpread);
  });

  test('fewer than 7 samples is learning and uses the fixed target', () => {
    const b = computeBaseline({
      metric: 'sleep',
      samples: [
        { day: '2026-11-15', value: 400 },
        { day: '2026-11-14', value: 410 },
      ],
      today: '2026-11-16',
      fallbackTarget: 420,
    });
    expect(b.learning).toBe(true);
    expect(b.sampleN).toBe(2);
    expect(b.median).toBe(405);
  });

  test('7+ samples gives a real normal', () => {
    const samples = Array.from({ length: 8 }, (_, i) => ({
      day: `2026-11-${String(15 - i).padStart(2, '0')}`,
      value: 400 + i * 10,
    }));
    const b = computeBaseline({
      metric: 'sleep',
      samples,
      today: '2026-11-16',
      fallbackTarget: 420,
    });
    expect(b.learning).toBe(false);
    expect(b.median).toBeGreaterThan(400);
    expect(b.sampleN).toBe(8);
  });

  test('weekday-aware spend normal prefers same weekday when enough samples', () => {
    // 2026-11-16 is a Monday. Four earlier Mondays over 8 weeks.
    const mondays = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((day) => ({
      day,
      value: 800,
    }));
    const otherDays = Array.from({ length: 10 }, (_, i) => ({
      day: `2026-11-${String(15 - i).padStart(2, '0')}`,
      value: 3000,
    })).filter((s) => !mondays.some((m) => m.day === s.day));

    const b = computeBaseline({
      metric: 'spend',
      samples: [...mondays, ...otherDays],
      today: '2026-11-16',
      fallbackTarget: 1500,
      weekdayAware: true,
    });
    expect(b.weekdayAware).toBe(true);
    expect(b.sampleN).toBe(4);
    expect(b.median).toBe(800);
  });

  test('falls back to overall normal with too few same-weekday samples', () => {
    const b = computeBaseline({
      metric: 'spend',
      samples: [
        { day: '2026-11-09', value: 800 },
        { day: '2026-11-14', value: 2000 },
      ],
      today: '2026-11-16',
      fallbackTarget: 1500,
      weekdayAware: true,
    });
    expect(b.weekdayAware).toBe(false);
    expect(b.median).toBe(1400);
  });
});
