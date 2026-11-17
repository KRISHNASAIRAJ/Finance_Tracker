/** Grouping the raw bucket timeline into nights for the cloud upload. */
jest.mock('../supabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

import { groupBucketsByNight } from '../sleepMotionCloudSync';
import type { MotionBucket } from '../../modules/sleep/sleepMotion';

const START = 21 * 60 + 30; // 21:30
const END = 9 * 60 + 30; // 09:30

function bucket(minute: number): MotionBucket {
  return { m: minute, v: 0.05, s: 0 };
}

describe('groupBucketsByNight', () => {
  it('assigns evening and after-midnight buckets to the same night', () => {
    const base = new Date(2026, 10, 17, 0, 0).getTime() / 60000;
    const evening = bucket(base - 120); // 22:00 on 16 Nov
    const morning = bucket(base + 120); // 02:00 on 17 Nov
    const groups = groupBucketsByNight([morning, evening], START, END);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('drops daytime buckets and returns nights newest first', () => {
    const base = new Date(2026, 10, 17, 0, 0).getTime() / 60000;
    const oldNight = bucket(base - 24 * 60 - 120);
    const newNight = bucket(base - 120);
    const daytime = bucket(base + 12 * 60);
    const groups = groupBucketsByNight([oldNight, daytime, newNight], START, END);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual([newNight]);
    expect(groups[1]).toEqual([oldNight]);
  });

  it('ignores invalid buckets', () => {
    expect(groupBucketsByNight([{ m: 0, v: 0 }, { m: NaN, v: 0 }], START, END)).toEqual([]);
  });
});
