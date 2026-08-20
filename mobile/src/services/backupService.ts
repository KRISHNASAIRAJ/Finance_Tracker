/**
 * backupService — Full data export/import to JSON files with backup management and cleanup.
 */
import { Paths, File, Directory } from 'expo-file-system';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';
import { useGarageStore } from '../modules/garage/store';
import { useInvestmentsStore } from '../modules/equity/store';
import { usePersonalStore } from '../modules/personal/store';

const BACKUP_DIR = new Directory(Paths.document, 'backups');
const BACKUP_PREFIX = 'meridian_';
const BACKUP_SUFFIX = '_data.json';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function getTodayFilename(): string {
  const d = new Date();
  return `${BACKUP_PREFIX}${pad(d.getDate())}_${pad(d.getMonth() + 1)}_${d.getFullYear()}${BACKUP_SUFFIX}`;
}

function parseBackupDate(filename: string): Date | null {
  const match = filename.match(/meridian_(\d{2})_(\d{2})_(\d{4})_data\.json/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
}

export interface AppBackup {
  version: number;
  timestamp: string;
  finance: ReturnType<typeof useFinanceStore.getState>;
  tasks: ReturnType<typeof useTasksStore.getState>;
  garage: ReturnType<typeof useGarageStore.getState>;
  investments: ReturnType<typeof useInvestmentsStore.getState>;
  personal: ReturnType<typeof usePersonalStore.getState>;
}

function ensureBackupDir() {
  if (!BACKUP_DIR.exists) {
    BACKUP_DIR.create({ intermediates: true, idempotent: true });
  }
}

export async function exportAllData(): Promise<string> {
  ensureBackupDir();

  const backup: AppBackup = {
    version: 1,
    timestamp: new Date().toISOString(),
    finance: useFinanceStore.getState(),
    tasks: useTasksStore.getState(),
    garage: useGarageStore.getState(),
    investments: useInvestmentsStore.getState(),
    personal: usePersonalStore.getState(),
  };

  const json = JSON.stringify(backup);
  const filename = getTodayFilename();
  const file = new File(BACKUP_DIR, filename);

  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true });
  file.write(json);

  return file.uri;
}

export async function getBackupFiles(): Promise<{ name: string; uri: string; date: Date }[]> {
  ensureBackupDir();
  const entries = BACKUP_DIR.list();
  const backups: { name: string; uri: string; date: Date }[] = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    const name = entry.name;
    if (!name.endsWith(BACKUP_SUFFIX)) continue;
    const date = parseBackupDate(name);
    if (!date) continue;
    backups.push({ name, uri: entry.uri, date });
  }

  backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  return backups;
}

export async function getLatestBackup(): Promise<{ uri: string; date: Date } | null> {
  const backups = await getBackupFiles();
  return backups.length > 0 ? backups[0] : null;
}

export async function importData(uri: string): Promise<boolean> {
  try {
    const file = new File(uri);
    if (!file.exists) return false;

    const json = await file.text();
    const backup: AppBackup = JSON.parse(json);

    if (!backup.version || !backup.finance || !backup.tasks) {
      return false;
    }

    useFinanceStore.setState(backup.finance);
    useTasksStore.setState(backup.tasks);
    useGarageStore.setState(backup.garage);
    if (backup.investments) useInvestmentsStore.setState(backup.investments);
    if (backup.personal) usePersonalStore.setState(backup.personal);

    return true;
  } catch {
    return false;
  }
}

export async function deleteBackup(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Non-fatal — stale backup file may remain
  }
}

export async function cleanOldBackups(keepDays: number = 30): Promise<void> {
  const backups = await getBackupFiles();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);

  for (const b of backups) {
    if (b.date < cutoff) {
      await deleteBackup(b.uri);
    }
  }
}

export const TASK_NAME = 'MERIDIAN_DAILY_BACKUP';
