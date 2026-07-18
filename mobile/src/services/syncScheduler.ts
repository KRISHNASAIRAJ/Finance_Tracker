import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { processSyncQueue } from "./syncQueue";

const SYNC_TASK = "meridian-sync-task";

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const result = await processSyncQueue();
    const status =
      result.failed === 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.Failed;
    return status;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerSyncTask(): Promise<boolean> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
  if (isRegistered) return true;

  try {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
      minimumInterval: 240, // 4 hours — background fallback only
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterSyncTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(SYNC_TASK);
  } catch {
    // already unregistered
  }
}

export async function triggerSyncNow(): Promise<void> {
  try {
    await BackgroundFetch.getStatusAsync();
    processSyncQueue();
  } catch {
    processSyncQueue();
  }
}
