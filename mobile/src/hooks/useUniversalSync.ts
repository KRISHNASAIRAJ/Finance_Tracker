/**
 * useUniversalSync — cloud→local hydration for the modules that enqueue writes
 * but had no global pull hook.
 *
 * Covers `weekly_diary` and `career_events`. (Meals, sleep, habits, weight and
 * meal plans are already pulled by usePersonalSync; garage has its own
 * initializer; people / medications / offers have module hooks.)
 *
 * Pattern matches the existing hooks: flush the queue first, leave rows with
 * a pending local edit alone, merge the rest, and push brand-new local rows.
 */
import { useCallback, useEffect, useRef } from 'react';

import { supabase } from '../services/supabaseClient';
import { useAuth } from '../services/AuthProvider';
import { useDiaryStore, type DiaryEntry } from '../modules/diary/store';
import { useCareerStore, type CareerEvent } from '../modules/career/store';
import {
  useServiceIssuesStore,
  type ServiceIssue,
} from '../modules/garage/serviceIssuesStore';

interface Spec<T> {
  table: string;
  map: (row: Record<string, unknown>) => T;
  local: () => T[];
  set: (rows: T[]) => void;
  toRow: (item: T, userId: string) => Record<string, unknown>;
}

const SPECS: Spec<DiaryEntry | CareerEvent | ServiceIssue>[] = [
  {
    table: 'weekly_diary',
    map: (r) => ({
      id: r.id as string,
      weekYear: Number(r.week_year) || 0,
      weekNumber: Number(r.week_number) || 0,
      content: (r.content as string) ?? '',
      updatedAt: (r.updated_at as string) ?? '',
    }),
    local: () => useDiaryStore.getState().entries as DiaryEntry[],
    set: (rows) => useDiaryStore.setState({ entries: rows as DiaryEntry[] }),
    toRow: (e, userId) => {
      const item = e as DiaryEntry;
      return {
        id: item.id,
        user_id: userId,
        week_year: item.weekYear,
        week_number: item.weekNumber,
        content: item.content,
      };
    },
  },
  {
    table: 'career_events',
    map: (r) => ({
      id: r.id as string,
      name: (r.name as string) ?? '',
      date: (r.date as string) ?? '',
      type: ((r.type as string) ?? 'balance') as CareerEvent['type'],
      notes: (r.notes as string) ?? '',
    }),
    local: () => useCareerStore.getState().events as CareerEvent[],
    set: (rows) => useCareerStore.setState({ events: rows as CareerEvent[] }),
    toRow: (e, userId) => {
      const item = e as CareerEvent;
      return {
        id: item.id,
        user_id: userId,
        name: item.name,
        date: item.date,
        type: item.type,
        notes: item.notes,
      };
    },
  },
  {
    table: 'vehicle_service_issues',
    map: (r) => ({
      id: r.id as string,
      vehicle: (r.vehicle as string) ?? '',
      title: (r.title as string) ?? '',
      notes: (r.notes as string) ?? '',
      severity: ((r.severity as string) ?? 'medium') as ServiceIssue['severity'],
      status: ((r.status as string) ?? 'open') as ServiceIssue['status'],
      odometerKm: r.odometer_km === null || r.odometer_km === undefined
        ? null
        : Number(r.odometer_km) || null,
      createdAt: (r.created_at as string) ?? '',
      fixedAt: (r.fixed_at as string) ?? null,
    }),
    local: () => useServiceIssuesStore.getState().issues as ServiceIssue[],
    set: (rows) => useServiceIssuesStore.setState({ issues: rows as ServiceIssue[] }),
    toRow: (e, userId) => {
      const item = e as ServiceIssue;
      return {
        id: item.id,
        user_id: userId,
        vehicle: item.vehicle,
        title: item.title,
        notes: item.notes,
        severity: item.severity,
        status: item.status,
        odometer_km: item.odometerKm,
        created_at: item.createdAt,
        fixed_at: item.fixedAt,
      };
    },
  },
];

export function useUniversalSync() {
  const { user } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;
    pull(user.id).catch(() => {});
  }, [user]);

  const refresh = useCallback(async () => {
    if (user) await pull(user.id);
  }, [user]);

  return { refresh };
}

export async function pull(userId: string) {
  try {
    const { processSyncQueue } = require('../services/syncQueue');
    await processSyncQueue(true);
  } catch {
    /* offline — the next launch / CRUD retries */
  }

  let pendingIds: Set<string> = new Set();
  try {
    const { getPendingEntityIds } = require('../services/syncQueue');
    pendingIds = await getPendingEntityIds();
  } catch {
    /* proceed without pending protection */
  }

  for (const spec of SPECS) {
    const { data, error } = await supabase
      .from(spec.table)
      .select('*')
      .eq('user_id', userId);
    if (error) {
      console.warn(`[UniversalSync] ${spec.table} pull failed:`, error.message);
      continue;
    }

    const cloudRows = (data ?? []) as Array<Record<string, unknown>>;
    const byId = new Map<string, DiaryEntry | CareerEvent | ServiceIssue>();
    for (const local of spec.local()) byId.set(local.id, local);
    for (const row of cloudRows) {
      const id = row.id as string;
      if (!id || pendingIds.has(`${spec.table}|${id}`)) continue;
      byId.set(id, spec.map(row));
    }
    spec.set(Array.from(byId.values()));

    // Brand-new offline rows are already queued by the stores; enqueue any
    // that somehow never made it into the queue.
    const cloudIds = new Set(cloudRows.map((r) => r.id as string));
    const missing = spec.local().filter((item) => !cloudIds.has(item.id));
    if (missing.length > 0) {
      try {
        const { enqueue } = require('../services/syncQueue');
        for (const item of missing) {
          await enqueue(spec.table, 'create', spec.toRow(item, userId));
        }
      } catch {
        /* best-effort */
      }
    }
  }
}

export default useUniversalSync;
