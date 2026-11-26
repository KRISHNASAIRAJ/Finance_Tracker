/**
 * cloudRecovery — one-time repair for a bad local restore.
 *
 * A restore overwrites Zustand/AsyncStorage but never touches Supabase. The
 * normal boot pull protects rows with pending queue ops and (before v16) only
 * wrote when the row COUNT changed, so a restored backup with the same rows
 * but stale values could survive a sync. This pass overwrites local finance
 * and task rows from the cloud directly, without flushing local data first.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueue } from './syncQueue';
import { forcePullFinance } from '../modules/finance/hooks/useFinanceSync';
import { forcePullTasks } from '../modules/tasks/hooks/useTasksSync';
import { syncEquityNow } from '../modules/equity/hooks/useEquitySync';
import { forcePullPersonal } from '../modules/personal/hooks/usePersonalSync';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';

const RECOVERY_FLAG = 'meridian-cloud-recovery-v2';
const SNAPSHOT_KEY = 'meridian-pre-cloud-recovery-snapshot-v2';

export async function runOneTimeCloudRecovery(userId: string): Promise<void> {
  if (!userId) return;
  try {
    if ((await AsyncStorage.getItem(RECOVERY_FLAG)) === '1') return;

    // If there is unsynced local work, let the normal boot flush it first and
    // retry on the next launch. Never overwrite pending edits.
    const queue = await getQueue();
    if (queue.length > 0) return;

    // Keep a Copy of the pre-recovery state so nothing is destroyed outright.
    try {
      await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        finance: useFinanceStore.getState(),
        tasks: useTasksStore.getState(),
        at: new Date().toISOString(),
      }));
    } catch (e) { console.warn('[cloudRecovery] snapshot failed:', e); }

    await forcePullFinance(userId);
    await forcePullTasks(userId);
    try { await forcePullPersonal(userId); }
    catch (e) { console.warn('[cloudRecovery] personal pull failed:', e); }
    try { await syncEquityNow(userId); }
    catch (e) { console.warn('[cloudRecovery] equity pull failed:', e); }

    await AsyncStorage.setItem(RECOVERY_FLAG, '1');
    console.log('[cloudRecovery] local finance/tasks restored from cloud');
  } catch (e) {
    console.warn('[cloudRecovery] failed (will retry next launch):', e);
  }
}
