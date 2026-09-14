/**
 * dailyContent.test.ts — deterministic quote/technique rotation.
 */
import { QUOTES, quoteForDate, stressTechniquesForDate, dayOfYearIST, PRINCIPLES } from '../../shared/dailyContent';

describe('dailyContent', () => {
  it('dayOfYearIST is stable and 1-based', () => {
    const jan1 = new Date('2026-01-01T00:00:00Z');
    expect(dayOfYearIST(jan1)).toBeGreaterThanOrEqual(1);
    expect(dayOfYearIST(jan1)).toBeLessThanOrEqual(3); // TZ slack around New Year
    const dec31 = new Date('2026-12-31T12:00:00Z');
    expect(dayOfYearIST(dec31)).toBeGreaterThanOrEqual(360);
    expect(dayOfYearIST(dec31)).toBeLessThanOrEqual(366);
  });

  it('same date -> same quote; different day -> deterministic pick', () => {
    // Both timestamps are within the same IST day (2026-09-14):
    // 01:00Z = 06:30 IST, 18:00Z = 23:30 IST.
    const a = quoteForDate(new Date('2026-09-14T01:00:00Z'));
    const b = quoteForDate(new Date('2026-09-14T18:00:00Z'));
    expect(a.text).toBe(b.text);

    // Verify the pick is the day-of-year modulo (stable contract).
    // 2026-09-14 is IST day-of-year 257; 257 % 16 = 1.
    const d = new Date('2026-09-14T05:00:00Z');
    expect(dayOfYearIST(d)).toBe(257);
    expect(quoteForDate(d).text).toBe(QUOTES[1].text);
  });

  it('always returns both stress techniques', () => {
    const techs = stressTechniquesForDate(new Date('2026-05-05T00:00:00Z'));
    expect(techs).toHaveLength(2);
    expect(techs[0].name).toBeTruthy();
    expect(techs[0].steps).toBeTruthy();
  });

  it('has a non-empty principles set', () => {
    expect(PRINCIPLES.length).toBeGreaterThanOrEqual(4);
    for (const p of PRINCIPLES) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(10);
    }
  });

  it('quotes carry a source', () => {
    for (const q of QUOTES) expect(q.source.length).toBeGreaterThan(0);
  });
});
