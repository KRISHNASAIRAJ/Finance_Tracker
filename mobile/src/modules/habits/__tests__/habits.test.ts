/**
 * habits.test.ts — pure-function tests for the habit module utils.
 */
import {
  HABITS,
  HABIT_KEYS,
  istDayKey,
  todayKey,
  parseHabits,
  dayProgress,
  dayPercent,
  progressBlocks,
  dayRange,
  daysInMonth,
  monthOf,
  shiftMonth,
  monthLabel,
  habitStreak,
  effectiveHabits,
} from '../habits';

describe('habits module', () => {
  it('defines exactly 10 canonical habits with unique keys', () => {
    expect(HABITS).toHaveLength(10);
    expect(new Set(HABIT_KEYS).size).toBe(10);
  });

  describe('istDayKey', () => {
    it('formats a UTC date into an IST day key', () => {
      // 2026-09-14 20:00 UTC = 2026-09-15 01:30 IST
      expect(istDayKey(new Date('2026-09-14T20:00:00Z'))).toBe('2026-09-15');
    });
    it('keeps the same IST day for morning UTC times', () => {
      expect(istDayKey(new Date('2026-09-14T03:00:00Z'))).toBe('2026-09-14');
    });
    it('accepts ISO strings', () => {
      expect(istDayKey('2026-09-14T20:00:00Z')).toBe('2026-09-15');
    });
  });

  it('todayKey returns a YYYY-MM-DD string', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe('parseHabits', () => {
    it('parses a JSON array string', () => {
      expect(parseHabits('["a","b"]')).toEqual(['a', 'b']);
    });
    it('accepts arrays directly', () => {
      expect(parseHabits(['a'])).toEqual(['a']);
    });
    it('returns [] on bad input', () => {
      expect(parseHabits('not json')).toEqual([]);
      expect(parseHabits(null)).toEqual([]);
      expect(parseHabits(undefined)).toEqual([]);
    });
  });

  describe('dayProgress / dayPercent / progressBlocks', () => {
    it('0 habits -> 0%', () => {
      expect(dayProgress([])).toBe(0);
      expect(dayPercent([])).toBe('0%');
    });
    it('all 10 habits -> 100% and full blocks', () => {
      expect(dayProgress(HABIT_KEYS)).toBe(1);
      expect(dayPercent(HABIT_KEYS)).toBe('100%');
      expect(progressBlocks(HABIT_KEYS)).toBe('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛ 100%');
    });
    it('caps over-ticked and ignores unknown keys', () => {
      expect(dayProgress([...HABIT_KEYS, 'bogus'])).toBe(1);
      expect(dayProgress(['bogus'])).toBe(0);
    });
    it('5 of 10 -> 50%', () => {
      expect(dayProgress(HABIT_KEYS.slice(0, 5))).toBe(0.5);
      expect(dayPercent(HABIT_KEYS.slice(0, 5))).toBe('50%');
      expect(progressBlocks(HABIT_KEYS.slice(0, 5))).toBe('⬛⬛⬛⬛⬛⬜⬜⬜⬜⬜ 50%');
    });
  });

  describe('dayRange', () => {
    it('returns inclusive keys', () => {
      expect(dayRange('2026-09-01', '2026-09-03')).toEqual([
        '2026-09-01', '2026-09-02', '2026-09-03',
      ]);
    });
    it('returns [] for inverted ranges', () => {
      expect(dayRange('2026-09-03', '2026-09-01')).toEqual([]);
    });
  });

  it('daysInMonth handles leap February', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-09')).toBe(30);
  });

  it('monthOf / shiftMonth / monthLabel', () => {
    expect(monthOf('2026-09-14')).toBe('2026-09');
    expect(shiftMonth('2026-09', 1)).toBe('2026-10');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-09')).toBe('September 2026');
  });

  describe('habitStreak', () => {
    it('counts consecutive days ending today', () => {
      const logMap: Record<string, string[]> = {
        '2026-09-14': ['water_3l'],
        '2026-09-13': ['water_3l'],
        '2026-09-12': ['water_3l'],
        '2026-09-11': [],
      };
      // Freeze "today" by monkey-patching nothing — streak reads real clock,
      // so run relative to actual today instead.
      const today = todayKey();
      const mk = (n: number) => istDayKey(new Date(Date.now() - n * 86400000));
      const map: Record<string, string[]> = {
        [today]: ['water_3l'],
        [mk(1)]: ['water_3l'],
        [mk(2)]: ['water_3l'],
        [mk(3)]: [],
      };
      expect(habitStreak('water_3l', (k) => map[k] ?? [])).toBe(3);
      expect(logMap['2026-09-14']).toBeDefined();
    });

    it('streak survives if today unticked but yesterday ticked', () => {
      const mk = (n: number) => istDayKey(new Date(Date.now() - n * 86400000));
      const map: Record<string, string[]> = {
        [mk(1)]: ['cook_meals'],
        [mk(2)]: ['cook_meals'],
      };
      expect(habitStreak('cook_meals', (k) => map[k] ?? [])).toBe(2);
    });

    it('returns 0 with no logs', () => {
      expect(habitStreak('no_junk', () => [])).toBe(0);
    });
  });

  describe('effectiveHabits (editable habit overrides)', () => {
    it('returns canonical set when overrides are null/empty', () => {
      expect(effectiveHabits(null)).toEqual(HABITS);
      expect(effectiveHabits([])).toEqual(HABITS);
      expect(effectiveHabits(undefined)).toEqual(HABITS);
    });
    it('uses overrides when provided (edited labels, added habits)', () => {
      const custom = [
        { key: 'sleep_6_7', label: 'Sleep 7 hours', emoji: '😴' },
        { key: 'stretch', label: 'Stretch 10 min', emoji: '🧘' },
      ];
      const out = effectiveHabits(custom);
      expect(out).toEqual(custom);
    });
    it('drops invalid entries and fills defaults', () => {
      const out = effectiveHabits([
        { key: 'a', label: '  ', emoji: '' },
        null as any,
        { key: 'b', label: 'Valid', emoji: '⭐' },
      ]);
      expect(out).toHaveLength(2);
      expect(out[0].label).toBe('Untitled habit');
      expect(out[0].emoji).toBe('⭐');
      expect(out[1].label).toBe('Valid');
    });
    it('dayProgress works against custom habit sets', () => {
      const custom = effectiveHabits([{ key: 'a', label: 'A', emoji: '⭐' }, { key: 'b', label: 'B', emoji: '⭐' }]);
      expect(dayProgress(['a'], custom)).toBe(0.5);
      expect(dayProgress(['a', 'b', 'zzz'], custom)).toBe(1);
    });
  });
});
