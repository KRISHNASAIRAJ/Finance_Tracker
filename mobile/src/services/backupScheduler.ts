/**
 * backupScheduler — Registers and schedules weekly background backup task via expo-background-fetch.
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { exportAllData, TASK_NAME, cleanOldBackups } from './backupService';

let isRegistered = false;
const BACKUP_DAY = 0; // Sunday

export async function registerBackupTask() {
  try {
    isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) return;
  } catch {
    isRegistered = false;
  }

  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 24 * 7, // weekly — fires ~once/week
      stopOnTerminate: false,
      startOnBoot: true,
    });
    isRegistered = true;
  } catch (err) {
    console.warn('[Backup] Failed to register task:', err);
  }
}

export async function scheduleNextBackup() {
  const now = new Date();
  const target = new Date();
  target.setHours(23, 0, 0, 0); // 11 PM

  const daysUntilSunday = (BACKUP_DAY + 7 - target.getDay()) % 7;
  target.setDate(target.getDate() + daysUntilSunday);

  if (target <= now) {
    target.setDate(target.getDate() + 7); // next Sunday
  }

  const delay = target.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await exportAllData();
      await cleanOldBackups(60); // keep 60 days (~8 weekly backups)
    } catch (err) {
      console.warn('[Backup] Scheduled backup failed:', err);
    }
    scheduleNextBackup();
  }, delay);
}

export async function triggerBackupNow(): Promise<string> {
  const path = await exportAllData();
  await cleanOldBackups(60);
  return path;
}
