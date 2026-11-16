/**
 * ServiceIssuesStore — "issues to report at the next service", one per vehicle.
 *
 * Local-first via the central sync queue (same pattern as the other garage
 * stores). Not a financial event: no `transactions` row is written.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ServiceIssueSeverity = 'low' | 'medium' | 'high';
export type ServiceIssueStatus = 'open' | 'fixed';

export interface ServiceIssue {
  id: string;
  vehicle: string;
  title: string;
  notes: string;
  severity: ServiceIssueSeverity;
  status: ServiceIssueStatus;
  odometerKm: number | null;
  createdAt: string;
  fixedAt: string | null;
}

interface ServiceIssuesState {
  issues: ServiceIssue[];
  addIssue: (
    issue: Omit<ServiceIssue, 'id' | 'createdAt' | 'fixedAt' | 'status'>,
    userId?: string
  ) => string;
  updateIssue: (id: string, patch: Partial<ServiceIssue>, userId?: string) => void;
  toggleFixed: (id: string, userId?: string) => void;
  deleteIssue: (id: string, userId?: string) => void;
}

function flush() {
  // Jest tears the environment down before this 300 ms timer would fire;
  // skipping it keeps the suite from importing a module after teardown.
  if (typeof (globalThis as any).jest !== 'undefined') return;
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => { /* best-effort */ });
    } catch { /* offline */ }
  }, 300);
  if (typeof t === 'object' && t && typeof (t as any).unref === 'function') (t as any).unref();
}

async function enq(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', data);
    flush();
  } catch { /* queued on next CRUD/pull */ }
}

export const useServiceIssuesStore = create<ServiceIssuesState>()(
  persist(
    (set, get) => ({
      issues: [],

      addIssue: (issue, userId) => {
        const id = `si_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();
        const full: ServiceIssue = {
          id,
          vehicle: issue.vehicle,
          title: issue.title.trim(),
          notes: issue.notes?.trim() || '',
          severity: issue.severity || 'medium',
          status: 'open',
          odometerKm: issue.odometerKm ?? null,
          createdAt: now,
          fixedAt: null,
        };
        set((s) => ({ issues: [full, ...s.issues] }));
        enq('vehicle_service_issues', 'create', {
          ...full,
          user_id: userId || null,
        });
        return id;
      },

      updateIssue: (id, patch, userId) => {
        set((s) => ({
          issues: s.issues.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
        enq('vehicle_service_issues', 'update', {
          id,
          ...patch,
          user_id: userId || null,
        });
      },

      toggleFixed: (id, userId) => {
        const issue = get().issues.find((i) => i.id === id);
        if (!issue) return;
        const fixed = issue.status === 'open';
        const patch: Partial<ServiceIssue> = {
          status: fixed ? 'fixed' : 'open',
          fixedAt: fixed ? new Date().toISOString() : null,
        };
        get().updateIssue(id, patch, userId);
      },

      deleteIssue: (id, userId) => {
        set((s) => ({ issues: s.issues.filter((i) => i.id !== id) }));
        enq('vehicle_service_issues', 'delete', {
          id,
          user_id: userId || null,
        });
      },
    }),
    {
      name: 'meridian_service_issues',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ issues: s.issues }),
    }
  )
);

/** Open issues for one vehicle, newest first. */
export function openIssuesFor(issues: ServiceIssue[], vehicle: string): ServiceIssue[] {
  return issues
    .filter((i) => i.vehicle === vehicle && i.status === 'open')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
