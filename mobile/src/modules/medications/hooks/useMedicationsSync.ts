/**
 * useMedicationsSync — Supabase pull/push sync for the medications module.
 * Mirrors useOffersSync: flush the local queue first, protect rows with
 * pending edits, merge cloud rows, push brand-new local-only rows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../services/AuthProvider';
import { useMedicationsStore, Medication, parseDoseTimes } from '../store';

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

export function useMedicationsSync() {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    loading: true,
    error: null,
    lastSyncAt: null,
  });
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;
    doPull(user.id).then(() => {
      setState({ loading: false, error: null, lastSyncAt: new Date() });
    });
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

async function doPull(userId: string) {
  try {
    const { processSyncQueue } = require('../../../services/syncQueue');
    await processSyncQueue(true);
  } catch (_e) { /* will retry on next pull / CRUD */ }

  let pendingIds: Set<string> = new Set();
  try {
    const { getPendingEntityIds } = require('../../../services/syncQueue');
    pendingIds = await getPendingEntityIds();
  } catch (_e) { /* no pending protection available — proceed */ }

  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('[MedicationsSync] pull failed:', error.message);
    return;
  }

  const store = useMedicationsStore;

  if (data && data.length > 0) {
    const existingIds = new Set(store.getState().medications.map((m) => m.id));
    const incoming: Medication[] = (data as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .filter((r) => !pendingIds.has(`medications|${r.id}`))
      .map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? '',
        dosage: (r.dosage as string) ?? '',
        times: parseDoseTimes(Array.isArray(r.times) ? (r.times as string[]) : []),
        notes: (r.notes as string) ?? '',
        active: r.active !== false,
      }))
      .filter((m) => m.name);
    if (incoming.length > 0) {
      store.setState({ medications: [...store.getState().medications, ...incoming] });
    }
  }

  // Push local-only rows (brand-new offline entries) missing in the cloud.
  const cloudIds = new Set((data ?? []).map((r: Record<string, unknown>) => r.id as string));
  const localOnly = store.getState().medications.filter((m) => !cloudIds.has(m.id));
  if (localOnly.length > 0) {
    const rows = localOnly.map((m) => ({
      id: m.id,
      user_id: userId,
      name: m.name,
      dosage: m.dosage || null,
      times: m.times,
      notes: m.notes || null,
      active: m.active,
      updated_at: new Date().toISOString(),
    }));
    supabase.from('medications').upsert(rows, { onConflict: 'id' }).then(({ error: e }) => {
      if (e) console.warn('[MedicationsSync] pushMissing medications:', e.message);
    });
  }
}
