import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useFinanceStore } from '../modules/finance/store';
import { useGarageStore } from '../modules/garage/store';
import { useTasksStore } from '../modules/tasks/store';
import { usePersonalStore } from '../modules/personal/store';
import { useEquityStore } from '../modules/equity/store';

const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const LAST_SYNC_KEY = 'meridian-last-sync';
const USER_ID_KEY = 'meridian-user-id';

let syncTimer: ReturnType<typeof setInterval> | null = null;

async function getUserId(): Promise<string> {
  const stored = await AsyncStorage.getItem(USER_ID_KEY);
  if (stored) return stored;
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await AsyncStorage.setItem(USER_ID_KEY, id);
  return id;
}

interface SyncResult {
  success: boolean;
  synced: string[];
  errors: string[];
}

const ENTITY_MAP: Record<string, () => unknown[]> = {
  transactions: () => useFinanceStore.getState().transactions,
  credit_cards: () => useFinanceStore.getState().cards,
  bank_accounts: () => useFinanceStore.getState().accounts,
  receivables: () => useFinanceStore.getState().receivables,
  fixed_expenses: () => useFinanceStore.getState().fixedExpenses,
  fuel_fills: () => useGarageStore.getState().fills,
  maintenance_logs: () => useGarageStore.getState().maintenance,
  tasks: () => useTasksStore.getState().tasks,
  notes: () => usePersonalStore.getState().notes,
  goals: () => usePersonalStore.getState().goals,
  recipes: () => usePersonalStore.getState().recipes,
  holdings: () => useEquityStore.getState().holdings,
};

export async function performSync(): Promise<SyncResult> {
  const result: SyncResult = { success: true, synced: [], errors: [] };

  try {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

    // Download server changes since last sync
    const downloadRes = await api.post<Record<string, unknown[]>>('/sync/download', {
      last_sync: lastSync || new Date(0).toISOString(),
    });

    for (const [entityType, records] of Object.entries(downloadRes)) {
      if (entityType === 'server_time') continue;
      if (Array.isArray(records) && records.length > 0) {
        result.synced.push(`${entityType}: ${records.length} downloaded`);
      }
    }

    // Upload local data as create payloads
    const payloads: { entity: string; action: string; data: unknown }[] = [];

    for (const [entityType, getItems] of Object.entries(ENTITY_MAP)) {
      const items = getItems();
      for (const item of items) {
        payloads.push({
          entity: entityType,
          action: 'create',
          data: item as Record<string, unknown>,
        });
      }
    }

    if (payloads.length > 0) {
      // Upload in batches to avoid huge requests
      const BATCH_SIZE = 50;
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        await api.post('/sync/upload', { payloads: batch });
      }
      result.synced.push(`${payloads.length} total items uploaded`);
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

export async function startSyncService(): Promise<void> {
  stopSyncService();

  syncTimer = setInterval(async () => {
    try {
      await api.get('/health');
      const result = await performSync();
      if (result.success) {
        console.log('[Sync] OK:', result.synced.join(', '));
      }
    } catch {
      console.log('[Sync] Offline, will retry in 1 hour');
    }
  }, SYNC_INTERVAL_MS);
}

export function stopSyncService(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
