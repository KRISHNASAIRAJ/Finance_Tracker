/**
 * usePeopleSync — Supabase pull/push sync for the "keep in touch" list.
 *
 * The same pattern as the other modules: flush the local queue first, protect
 * the rows that still have a pending edit, merge the cloud rows and push the
 * brand-new local-only rows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../services/AuthProvider';
import { usePeopleStore, type Person } from '../store';
import { DEFAULT_CADENCE, type PeopleCadence } from '../peopleCadence';

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

export function usePeopleSync() {
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
  } catch (_e) { /* will retry on the next pull / CRUD */ }

  let pendingIds: Set<string> = new Set();
  try {
    const { getPendingEntityIds } = require('../../../services/syncQueue');
    pendingIds = await getPendingEntityIds();
  } catch (_e) { /* no pending protection available — proceed */ }

  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('[PeopleSync] pull failed:', error.message);
    return;
  }

  const store = usePeopleStore;

  if (data && data.length > 0) {
    const existingIds = new Set(store.getState().people.map((p) => p.id));
    const incoming: Person[] = (data as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .filter((r) => !pendingIds.has(`people|${r.id}`))
      .map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? '',
        phone: (r.phone as string) || undefined,
        email: (r.email as string) || undefined,
        notes: (r.notes as string) || undefined,
        cadence: ((r.cadence as PeopleCadence) || DEFAULT_CADENCE),
        intervalDays: (r.interval_days as number) ?? undefined,
        lastContactedAt: (r.last_contacted_at as string) || undefined,
        nextDueAt: (r.next_due_at as string) ?? new Date().toISOString(),
      }))
      .filter((p) => p.name);
    if (incoming.length > 0) {
      store.setState({ people: [...store.getState().people, ...incoming] });
    }
  }

  // Push local-only rows (brand-new offline entries) missing in the cloud.
  const cloudIds = new Set((data ?? []).map((r: Record<string, unknown>) => r.id as string));
  const localOnly = store.getState().people.filter((p) => !cloudIds.has(p.id));
  if (localOnly.length > 0) {
    const rows = localOnly.map((p) => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      phone: p.phone || null,
      email: p.email || null,
      notes: p.notes || null,
      cadence: p.cadence,
      interval_days: p.intervalDays ?? null,
      last_contacted_at: p.lastContactedAt || null,
      next_due_at: p.nextDueAt,
      updated_at: new Date().toISOString(),
    }));
    supabase.from('people').upsert(rows, { onConflict: 'id' }).then(({ error: e }) => {
      if (e) console.warn('[PeopleSync] pushMissing people:', e.message);
    });
  }
}
