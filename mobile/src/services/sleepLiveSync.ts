/**
 * sleepLiveSync — an hourly cloud backup of the in-progress sleep night.
 *
 * The native motion service records the night on the device; until now the
 * timeline only landed in the cloud when the user next opened the app and ran
 * autoSave. This task pushes a *live* snapshot row into `sleep_logs` every
 * hour (a stable row per night, id `live_<yyyy-mm-dd>`) so the cloud — and the
 * web — always sees the running night. In the morning, autoSave promotes the
 * same row to the final record (same id, no duplicates).
 *
 * Cadence honesty: the OS decides the real floor for background fetch —
 * `minimumInterval` is a floor, not a guarantee. The snapshot is ALSO pushed
 * on every app open/foreground, so it is as fresh as the device can make it.
 */
import { processSyncQueue } from './syncQueue';
import { useSleepStore } from '../modules/sleep/store';
import {
  DEFAULT_SLEEP_MOTION_CONFIG,
  getMotionBuckets,
  isSleepMotionAvailable,
} from '../modules/sleep/sleepMotion';
import {
  inferSleepSession,
  motionThreshold,
  movingSecondsThreshold,
} from '../modules/sleep/sleepInference';
import { isSameNight } from '../modules/sleep/sleepNights';
import { localDayKey } from '../modules/finance/financeFormat';
import { supabase } from './supabaseClient';

const LIVE_TASK = 'meridian-sleep-live-sync';
const LIVE_ID = (dayKey: string) => `live_${dayKey}`;
/** Fewer buckets than this and the night is not worth backing up. */
const MIN_BUCKETS = 20;
const LIVE_NOTES = 'Auto-detected (live)';

let TaskManager: any = null;
let BackgroundFetch: any = null;

function ensureTasks(): boolean {
  if (TaskManager && BackgroundFetch) return true;
  try {
    // Dynamic requires — optional native modules unavailable in Expo Go
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    TaskManager = require('expo-task-manager');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BackgroundFetch = require('expo-background-fetch');
    return true;
  } catch {
    return false;
  }
}

export interface LiveNight {
  startMs: number;
  endMs: number;
  interruptions: number;
}

/** The in-progress (or just-ended) night from the motion timeline. */
export async function collectLiveNight(now: number = Date.now()): Promise<LiveNight | null> {
  if (!isSleepMotionAvailable()) return null;
  const cfg = useSleepStore.getState().autoConfig ?? DEFAULT_SLEEP_MOTION_CONFIG;
  if (!cfg.enabled) return null;
  try {
    const buckets = await getMotionBuckets();
    if (!buckets || buckets.length === 0) return null;
    const cutoff = now - 18 * 3600 * 1000;
    const recent = buckets.filter((b) => b.m * 60000 >= cutoff);
    if (recent.length < MIN_BUCKETS) return null;
    const inferred = inferSleepSession(recent, {
      threshold: motionThreshold(cfg.sensitivity),
      movingSeconds: movingSecondsThreshold(cfg.sensitivity),
      sleepStartMin: cfg.sleepStartMin,
      sleepEndMin: cfg.sleepEndMin,
      minSessionMin: 30, // partial nights are worth backing up
      wakeStartMin: cfg.wakeStartMin,
      wakeEndMin: cfg.wakeEndMin,
    });
    const lastBucketEnd = (recent[recent.length - 1].m + 1) * 60000;
    const startMs = inferred?.bedTime ?? recent[0].m * 60000;
    const endMs = inferred?.wakeTime ?? lastBucketEnd;
    if (endMs - startMs < 30 * 60 * 1000) return null;
    return { startMs, endMs, interruptions: inferred?.interruptions ?? 0 };
  } catch {
    return null;
  }
}

export type LiveSyncResult = 'pushed' | 'none' | 'unauthenticated' | 'error';

/** Push (or refresh) the live row for tonight, and prune stale ones. */
export async function pushLiveNight(now: number = Date.now()): Promise<LiveSyncResult> {
  try {
    // Flush anything the user did on this device first — ordering matters
    // for the "final record supersedes live row" cleanup below.
    await processSyncQueue().catch(() => {});
    const night = await collectLiveNight(now);
    if (!night) return 'none';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'unauthenticated';
    const dayKey = localDayKey(new Date(night.startMs));
    const id = LIVE_ID(dayKey);
    const { error } = await supabase.from('sleep_logs').upsert(
      {
        id,
        user_id: user.id,
        start_time: new Date(night.startMs).toISOString(),
        end_time: new Date(night.endMs).toISOString(),
        interruptions: night.interruptions,
        notes: LIVE_NOTES,
        source: 'auto-motion',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) return 'error';

    // Prune old live rows whose night already has a final (non-live) entry.
    try {
      const { data: stale } = await supabase
        .from('sleep_logs')
        .select('id, start_time, end_time')
        .eq('user_id', user.id)
        .like('id', 'live_%')
        .lt('end_time', new Date(now - 36 * 3600 * 1000).toISOString());
      const entries = useSleepStore.getState().entries as Array<{
        startTime: string;
        endTime: string;
        notes?: string;
      }>;
      for (const row of stale ?? []) {
        const range = {
          startTime: row.start_time as string,
          endTime: row.end_time as string,
        };
        const hasFinal = entries.some(
          (e) => !String(e.notes ?? '').startsWith(LIVE_NOTES) && isSameNight(e, range),
        );
        if (hasFinal) {
          await supabase.from('sleep_logs').delete().eq('id', row.id as string).eq('user_id', user.id);
        }
      }
    } catch {
      /* best-effort cleanup */
    }
    return 'pushed';
  } catch {
    return 'error';
  }
}

function defineTask(): boolean {
  if (!ensureTasks()) return false;
  try {
    TaskManager.defineTask(LIVE_TASK, async () => {
      const result = await pushLiveNight();
      return result === 'pushed'
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    });
    return true;
  } catch {
    return false;
  }
}

/** Register the hourly live-sync task (idempotent). */
export async function registerSleepLiveSync(): Promise<boolean> {
  if (!defineTask()) return false;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(LIVE_TASK);
    if (registered) return true;
    await BackgroundFetch.registerTaskAsync(LIVE_TASK, {
      minimumInterval: 3600, // hourly floor — the OS may stretch it
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Fire-and-forget push — called on every app open/foreground. */
export function triggerSleepLiveSync(): void {
  pushLiveNight().catch(() => {});
}
