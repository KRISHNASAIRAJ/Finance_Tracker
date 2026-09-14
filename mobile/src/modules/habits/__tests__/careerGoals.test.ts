/**
 * careerGoals.test.ts — effectiveGoals override handling.
 */
import { CAREER_GOALS, effectiveGoals, currentYearGoalsFrom } from '../../../shared/careerGoals';

describe('effectiveGoals', () => {
  it('returns canonical set when overrides are null/empty', () => {
    expect(effectiveGoals(null)).toEqual(CAREER_GOALS);
    expect(effectiveGoals([])).toEqual(CAREER_GOALS);
  });
  it('uses overrides verbatim when provided', () => {
    const custom = [
      { year: 2026, title: 'Momentum+', emoji: '🚀', items: ['New goal A', 'New goal B'], done: false },
    ];
    expect(effectiveGoals(custom)).toEqual(custom);
    // done flag is normalized to boolean
    const truthy = effectiveGoals([{ year: 2027, title: 'X', emoji: '🎯', items: [], done: true }] as any);
    expect(truthy[0].done).toBe(true);
  });
  it('sorts by year and sanitizes bad entries', () => {
    const out = effectiveGoals([
      { year: 2028, title: '', emoji: '', items: ['x', 42 as any, '  '] },
      { year: 2026, title: 'Valid', emoji: '🎯', items: ['ok'] },
      { year: NaN, title: 'Bad', emoji: '❌', items: [] },
    ]);
    expect(out.map((g) => g.year)).toEqual([2026, 2028]);
    expect(out[1].title).toBe('Untitled');
    expect(out[1].emoji).toBe('🎯');
    expect(out[1].items).toEqual(['x']);
    expect(out[1].done).toBe(false);
  });
});

describe('currentYearGoalsFrom', () => {
  it('finds the current year in an effective list', () => {
    const list = effectiveGoals([{ year: 2026, title: 'Now', emoji: '🚀', items: [] }]);
    expect(currentYearGoalsFrom(list, new Date('2026-06-01T00:00:00Z'))?.title).toBe('Now');
  });
  it('returns undefined when the year is absent', () => {
    const list = effectiveGoals([{ year: 2030, title: 'Later', emoji: '🌾', items: [] }]);
    expect(currentYearGoalsFrom(list, new Date('2026-06-01T00:00:00Z'))).toBeUndefined();
  });
});
