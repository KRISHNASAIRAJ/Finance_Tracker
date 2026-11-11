/**
 * medicationsStore — pill/medication reminders with daily dose times.
 *
 * Local-first (AsyncStorage) with every write pushed through the central
 * sync queue. Dose times are stored as "HH:MM" strings in IST.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Medication {
  id: string;
  name: string;
  /** e.g. "500 mg" */
  dosage: string;
  /** Daily dose times, "HH:MM" (24h), sorted */
  times: string[];
  notes: string;
  /** Paused medications keep their data but send no reminders */
  active: boolean;
}

interface MedicationsState {
  medications: Medication[];
  /** Doses skipped today: `${medId}|${YYYY-MM-DD}|${HH:MM}` → skipped at */
  skipped: Record<string, string>;
  addMedication: (med: Omit<Medication, 'id' | 'active'> & { active?: boolean }, userId?: string) => string;
  updateMedication: (id: string, data: Partial<Medication>, userId?: string) => void;
  deleteMedication: (id: string, userId?: string) => void;
  /** Mark a dose as skipped so it is not scheduled again that day. */
  skipDose: (medId: string, dateKey: string, time: string) => void;
  clearSkips: (dateKey: string) => void;
}

/** IST day key (YYYY-MM-DD). */
export function medDayKey(d: Date = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Key that identifies one dose of one medication on one day. */
export function doseKey(medId: string, dateKey: string, time: string): string {
  return `${medId}|${dateKey}|${time}`;
}

/**
 * Parse a free-text list of dose times ("08:00, 20:00") into clean
 * "HH:MM" values. Invalid entries are dropped, duplicates removed, sorted.
 */
export function parseDoseTimes(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,;\s]+/);
  const seen = new Set<string>();
  for (const item of raw) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(item).trim());
    if (!m) continue;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) continue;
    seen.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return Array.from(seen).sort();
}

/** Minutes since midnight for a "HH:MM" string (null when invalid). */
export function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export interface NextDose {
  time: string;
  /** The next time this dose should fire (today if still ahead, else tomorrow) */
  at: Date;
}

/**
 * The next dose time across a medication's schedule. `now` is expected to
 * be an IST-ish local date; the returned Date is a local Date.
 */
export function nextDose(times: string[], now: Date = new Date()): NextDose | null {
  let best: NextDose | null = null;
  for (const time of times) {
    const mins = timeToMinutes(time);
    if (mins === null) continue;
    const at = new Date(now);
    at.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    if (at.getTime() <= now.getTime()) {
      at.setDate(at.getDate() + 1);
    }
    if (!best || at.getTime() < best.at.getTime()) {
      best = { time, at };
    }
  }
  return best;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) { /* best-effort */ }
  }, 300);
  if (typeof t === 'object' && t && typeof (t as any).unref === 'function') {
    (t as any).unref();
  }
}

async function enq(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', data);
    flush();
  } catch (_e) { /* best-effort */ }
}

/** Best-effort refresh of the medication reminders after a change. */
function refreshReminders() {
  try {
    const { scheduleMedicationReminders } = require('../../services/medicationReminders');
    scheduleMedicationReminders().catch((_e: Error) => {});
  } catch (_e) { /* best-effort */ }
}

function normalize(med: Medication): Medication {
  return {
    ...med,
    name: (med.name || '').trim(),
    dosage: (med.dosage || '').trim(),
    times: parseDoseTimes(med.times || []),
    notes: (med.notes || '').trim(),
    active: med.active !== false,
  };
}

export const useMedicationsStore = create<MedicationsState>()(
  persist(
    (set, get) => ({
      medications: [],
      skipped: {},

      addMedication: (med, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const full = normalize({ ...med, id, active: med.active !== false });
        set((s) => ({ medications: [...s.medications, full] }));
        enq('medications', 'create', {
          id,
          user_id: userId || null,
          name: full.name,
          dosage: full.dosage || null,
          times: full.times,
          notes: full.notes || null,
          active: full.active,
          updated_at: new Date().toISOString(),
        });
        refreshReminders();
        return id;
      },

      updateMedication: (id, data, userId) => {
        const current = get().medications.find((m) => m.id === id);
        if (!current) return;
        const merged = normalize({ ...current, ...data, id });
        set((s) => ({ medications: s.medications.map((m) => (m.id === id ? merged : m)) }));
        enq('medications', 'create', {
          id,
          user_id: userId || null,
          name: merged.name,
          dosage: merged.dosage || null,
          times: merged.times,
          notes: merged.notes || null,
          active: merged.active,
          updated_at: new Date().toISOString(),
        });
        refreshReminders();
      },

      deleteMedication: (id, userId) => {
        set((s) => ({ medications: s.medications.filter((m) => m.id !== id) }));
        enq('medications', 'delete', { id, user_id: userId || null });
        refreshReminders();
      },

      skipDose: (medId, dateKey, time) => {
        set((s) => ({
          skipped: { ...s.skipped, [doseKey(medId, dateKey, time)]: new Date().toISOString() },
        }));
      },

      clearSkips: (dateKey) => {
        set((s) => {
          const next: Record<string, string> = {};
          // Dose keys look like `${medId}|${dateKey}|${time}`.
          for (const [k, v] of Object.entries(s.skipped || {})) {
            if (!k.includes(`|${dateKey}|`)) next[k] = v;
          }
          return { skipped: next };
        });
      },
    }),
    {
      name: 'meridian-medications-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
