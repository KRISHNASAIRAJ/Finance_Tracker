/**
 * sleepMotionCloudSync — upload the raw per-minute sleep motion timeline.
 *
 * The native tracker keeps the buckets in SharedPreferences. The cloud copy
 * (one JSONB row per night) exists so the scoring algorithm can be validated
 * and tuned against real nights. Pushed on the same cadence as `sleepLiveSync`
 * — hourly in the background and on every foreground — and best-effort: being
 * offline never affects tracking or the app.
 */
import { supabase } from './supabaseClient';
import { useSleepStore } from '../modules/sleep/store';
import {
  DEFAULT_SLEEP_MOTION_CONFIG,
  getMotionBuckets,
  isSleepMotionAvailable,
  type MotionBucket,
} from '../modules/sleep/sleepMotion';
import { nightKeyForMinute } from '../modules/sleep/sleepInference';
import { localDayKey } from '../modules/finance/financeFormat';

export type MotionCloudResult = 'pushed' | 'none' | 'unauthenticated' | 'error';

/** Group a flat bucket timeline into nights, newest first. */
export function groupBucketsByNight(
  buckets: MotionBucket[],
  sleepStartMin: number,
  sleepEndMin: number
): MotionBucket[][] {
  const byNight = new Map<number, MotionBucket[]>();
  for (const b of buckets) {
    const minute = Math.floor(Number(b?.m));
    if (!Number.isFinite(minute) || minute <= 0) continue;
    const key = nightKeyForMinute(minute, sleepStartMin, sleepEndMin);
    if (key === null) continue; // daytime — not part of any night
    const list = byNight.get(key);
    if (list) list.push(b);
    else byNight.set(key, [b]);
  }
  return Array.from(byNight.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, list]) => list);
}

export async function pushMotionNights(): Promise<MotionCloudResult> {
  if (!isSleepMotionAvailable()) return 'none';
  try {
    const cfg = useSleepStore.getState().autoConfig ?? DEFAULT_SLEEP_MOTION_CONFIG;
    if (!cfg.enabled) return 'none';

    const buckets = await getMotionBuckets();
    if (buckets.length === 0) return 'none';

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'unauthenticated';

    const nights = groupBucketsByNight(
      buckets,
      cfg.sleepStartMin,
      cfg.sleepEndMin
    ).filter((night) => night.length >= 20);
    if (nights.length === 0) return 'none';

    const rows = nights.map((night) => {
      const sorted = [...night].sort((a, b) => a.m - b.m);
      const first = sorted[0].m;
      const last = sorted[sorted.length - 1].m;
      const dayKey = localDayKey(new Date(first * 60000));
      return {
        id: `mn_${dayKey}`,
        user_id: user.id,
        buckets: sorted,
        start_minute: first,
        end_minute: last,
        bucket_count: sorted.length,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('sleep_motion_nights')
      .upsert(rows, { onConflict: 'id' });
    if (error) return 'error';
    return 'pushed';
  } catch {
    return 'error';
  }
}
