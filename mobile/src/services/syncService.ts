import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { useFinanceStore } from '../modules/finance/store';
import { useGarageStore } from '../modules/garage/store';
import { useTasksStore } from '../modules/tasks/store';
import { usePersonalStore } from '../modules/personal/store';
import { useEquityStore } from '../modules/equity/store';

const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const LAST_SYNC_KEY = 'meridian-last-sync';

let syncTimer: ReturnType<typeof setInterval> | null = null;

interface SyncResult {
  success: boolean;
  synced: string[];
  errors: string[];
}

async function upsertTable(table: string, data: unknown[]): Promise<number> {
  if (data.length === 0) return 0;
  const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.length;
}

export async function performSync(): Promise<SyncResult> {
  const result: SyncResult = { success: true, synced: [], errors: [] };

  try {
    const state = {
      finance: useFinanceStore.getState(),
      garage: useGarageStore.getState(),
      tasks: useTasksStore.getState(),
      personal: usePersonalStore.getState(),
      equity: useEquityStore.getState(),
    };

    const ops = [
      upsertTable('transactions', state.finance.transactions as unknown[]),
      upsertTable('credit_cards', state.finance.cards as unknown[]),
      upsertTable('bank_accounts', state.finance.accounts as unknown[]),
      upsertTable('receivables', state.finance.receivables as unknown[]),
      upsertTable('fixed_expenses', state.finance.fixedExpenses as unknown[]),
      upsertTable('fuel_fills', state.garage.fills as unknown[]),
      upsertTable('maintenance_logs', state.garage.maintenance as unknown[]),
      upsertTable('tasks', state.tasks.tasks as unknown[]),
      upsertTable('notes', state.personal.notes as unknown[]),
      upsertTable('goals', state.personal.goals as unknown[]),
      upsertTable('recipes', state.personal.recipes as unknown[]),
      upsertTable('holdings', state.equity.holdings as unknown[]),
    ];

    const counts = await Promise.all(ops);
    const total = counts.reduce((a, b) => a + b, 0);
    result.synced.push(`${total} records synced`);

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
