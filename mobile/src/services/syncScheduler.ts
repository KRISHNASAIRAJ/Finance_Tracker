/**
 * syncScheduler — Expo background-fetch task that periodically triggers the sync queue processor.
 */
import { processSyncQueue } from "./syncQueue";

const SYNC_TASK = "meridian-sync-task";

let BackgroundFetch: any = null;
let TaskManager: any = null;

function ensure() {
  if (BackgroundFetch) return true;
  try {
    // Dynamic requires — optional native modules unavailable in Expo Go
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BackgroundFetch = require("expo-background-fetch");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    TaskManager = require("expo-task-manager");
    return true;
  } catch {
    return false;
  }
}

function initTask() {
  if (!ensure()) return;
  try {
    TaskManager.defineTask(SYNC_TASK, async () => {
      try {
        const result = await processSyncQueue();
        return result.failed === 0
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.Failed;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch {
    // Background fetch unavailable in this environment
  }
}

export async function registerSyncTask(): Promise<boolean> {
  if (!ensure()) return false;
  initTask();
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
    if (isRegistered) return true;
    await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
      minimumInterval: 240,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterSyncTask(): Promise<void> {
  if (!ensure()) return;
  try {
    await BackgroundFetch.unregisterTaskAsync(SYNC_TASK);
  } catch {
    // Task may already be unregistered
  }
}

export async function triggerSyncNow(): Promise<void> {
  processSyncQueue();
}
