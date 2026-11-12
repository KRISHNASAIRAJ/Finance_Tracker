/**
 * sleepNights — the "same night?" rule.
 */
import { dedupeEntries, findSameNight, isSameNight } from '../sleepNights';

const night = (start: string, end: string) => ({ startTime: start, endTime: end });

describe('isSameNight', () => {
  it('treats overlapping sessions as the same night', () => {
    // The tracker detected 23:10 → 07:05, the user logged 23:00 → 07:00.
    expect(
      isSameNight(
        night('2026-11-11T23:10:00.000Z', '2026-11-12T07:05:00.000Z'),
        night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z')
      )
    ).toBe(true);
  });

  it('treats sessions that start less than 60 minutes apart as one night', () => {
    // The tracker detected 23:00 → 01:00, the user logged 23:30 → 01:30.
    expect(
      isSameNight(
        night('2026-11-11T23:00:00.000Z', '2026-11-12T01:00:00.000Z'),
        night('2026-11-11T23:30:00.000Z', '2026-11-12T01:30:00.000Z')
      )
    ).toBe(true);
  });

  it('keeps a night that was genuinely split by a long wake-up as two records', () => {
    expect(
      isSameNight(
        night('2026-11-11T23:00:00.000Z', '2026-11-12T03:00:00.000Z'),
        night('2026-11-12T03:30:00.000Z', '2026-11-12T07:00:00.000Z')
      )
    ).toBe(false);
  });

  it('keeps a nap and the night that follows apart', () => {
    expect(
      isSameNight(
        night('2026-11-11T15:00:00.000Z', '2026-11-11T16:00:00.000Z'),
        night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z')
      )
    ).toBe(false);
  });

  it('keeps two different nights apart', () => {
    expect(
      isSameNight(
        night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z'),
        night('2026-11-12T23:00:00.000Z', '2026-11-13T07:00:00.000Z')
      )
    ).toBe(false);
  });

  it('never blows up on a broken timestamp', () => {
    expect(isSameNight(night('nope', 'nope'), night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z'))).toBe(false);
  });
});

describe('findSameNight', () => {
  it('finds the record of the same night', () => {
    const entries = [
      { id: 'a', ...night('2026-11-10T23:00:00.000Z', '2026-11-11T07:00:00.000Z') },
      { id: 'b', ...night('2026-11-11T23:05:00.000Z', '2026-11-12T07:00:00.000Z') },
    ];
    const hit = findSameNight(entries, night('2026-11-11T23:00:00.000Z', '2026-11-12T07:10:00.000Z'));
    expect(hit?.id).toBe('b');
  });

  it('returns null when there is none', () => {
    const entries = [
      { id: 'a', ...night('2026-11-10T23:00:00.000Z', '2026-11-11T07:00:00.000Z') },
    ];
    expect(findSameNight(entries, night('2026-11-12T23:00:00.000Z', '2026-11-13T07:00:00.000Z'))).toBeNull();
  });
});

describe('dedupeEntries', () => {
  it('keeps one record per night', () => {
    const entries = [
      { id: 'a', ...night('2026-11-11T23:10:00.000Z', '2026-11-12T07:05:00.000Z') },
      { id: 'b', ...night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z') },
      { id: 'c', ...night('2026-11-12T23:00:00.000Z', '2026-11-13T07:00:00.000Z') },
    ];
    const deduped = dedupeEntries(entries);
    expect(deduped.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('leaves a clean list alone', () => {
    const entries = [
      { id: 'a', ...night('2026-11-11T23:00:00.000Z', '2026-11-12T07:00:00.000Z') },
      { id: 'b', ...night('2026-11-12T23:00:00.000Z', '2026-11-13T07:00:00.000Z') },
    ];
    expect(dedupeEntries(entries)).toHaveLength(2);
  });
});
