import {
  ALL_CARE_KEYS,
  CareDay,
  careDayId,
  careDayKey,
  careProgress,
  careStreak,
  shiftCareDay,
} from '../careData';

function day(key: string, done: string[]): CareDay {
  return { id: careDayId(key), day: key, done, pain: null };
}

describe('occipital care data helpers', () => {
  it('computes IST day keys regardless of UTC time', () => {
    // 00:00 UTC is 05:30 IST on the same calendar day.
    expect(careDayKey('2026-11-23T00:00:00.000Z')).toBe('2026-11-23');
    // 20:00 UTC is 01:30 IST the next day.
    expect(careDayKey('2026-11-23T20:00:00.000Z')).toBe('2026-11-24');
  });

  it('builds a stable row id from a day key', () => {
    expect(careDayId('2026-11-23')).toBe('oc_20261123');
  });

  it('shifts day keys across month boundaries', () => {
    expect(shiftCareDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftCareDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('calculates progress against the canonical item list and ignores unknown keys', () => {
    const two = ALL_CARE_KEYS.slice(0, 2);
    expect(careProgress([...two, 'not_a_real_key'])).toBeCloseTo(2 / ALL_CARE_KEYS.length);
    expect(careProgress([])).toBe(0);
    expect(careProgress(ALL_CARE_KEYS)).toBe(1);
  });

  it('counts a streak back from today, tolerating an unticked today', () => {
    const today = careDayKey(new Date());
    const t1 = shiftCareDay(today, -1);
    const t2 = shiftCareDay(today, -2);
    const t4 = shiftCareDay(today, -4);

    const days = [
      day(today, []), // today not ticked yet — streak still alive from yesterday
      day(t1, ['chin_tucks']),
      day(t2, ['chin_tucks']),
      day(t4, ['chin_tucks']), // gap at t3 breaks the run
    ];

    expect(careStreak(days, 'chin_tucks')).toBe(2);
    expect(careStreak(days, 'never_ticked')).toBe(0);
  });
});
