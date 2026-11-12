/**
 * peopleStore — the "keep in touch" list.
 *
 * Local-first (AsyncStorage) with every write pushed through the central sync
 * queue, so the list survives a reinstall and follows the account.
 *
 * The interval maths lives in peopleCadence.ts (pure, unit tested).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_CADENCE,
  daysUntilDue,
  isDue,
  isOverdue,
  nextDueFrom,
  type PeopleCadence,
} from './peopleCadence';

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** weekly | monthly | days_45 | custom */
  cadence: PeopleCadence;
  /** The length of a custom interval in days. */
  intervalDays?: number;
  /** When the person was last contacted (ISO). */
  lastContactedAt?: string;
  /** When the person is next due (ISO). */
  nextDueAt: string;
}

interface PeopleState {
  people: Person[];
  addPerson: (
    person: Omit<Person, 'id' | 'nextDueAt'> & { lastContactedAt?: string },
    userId?: string
  ) => string;
  updatePerson: (id: string, data: Partial<Person>, userId?: string) => void;
  deletePerson: (id: string, userId?: string) => void;
  /** Mark the contact as done — the next due date moves one interval forward. */
  markContacted: (id: string, userId?: string) => void;
  /** The people who are due today or overdue. */
  getDue: (now?: Date) => Person[];
  /** The people due within the next `days` days. */
  getUpcoming: (days?: number, now?: Date) => Person[];
  /** Everyone else. */
  getLater: (now?: Date) => Person[];
  /** How many people are due right now. */
  dueCount: (now?: Date) => number;
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

/** Re-arm the daily digest after the list changed. */
function refreshDigest() {
  try {
    const { schedulePeopleDigest } = require('../../services/notificationService');
    schedulePeopleDigest().catch((_e: Error) => {});
  } catch (_e) { /* best-effort */ }
}

function normalize(person: Person): Person {
  return {
    ...person,
    name: (person.name || '').trim(),
    phone: (person.phone || '').trim() || undefined,
    email: (person.email || '').trim() || undefined,
    notes: (person.notes || '').trim() || undefined,
    cadence: person.cadence || DEFAULT_CADENCE,
    intervalDays:
      person.cadence === 'custom' ? person.intervalDays || 30 : person.intervalDays,
  };
}

export const usePeopleStore = create<PeopleState>()(
  persist(
    (set, get) => ({
      people: [],

      addPerson: (person, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const nextDue = nextDueFrom(
          person.lastContactedAt ? new Date(person.lastContactedAt) : null,
          person.cadence || DEFAULT_CADENCE,
          person.intervalDays
        );
        const full = normalize({ ...person, id, nextDueAt: nextDue.toISOString() });
        set((s) => ({ people: [...s.people, full] }));
        enq('people', 'create', {
          id,
          user_id: userId || null,
          name: full.name,
          phone: full.phone || null,
          email: full.email || null,
          notes: full.notes || null,
          cadence: full.cadence,
          interval_days: full.intervalDays ?? null,
          last_contacted_at: full.lastContactedAt || null,
          next_due_at: full.nextDueAt,
          sort_order: get().people.length,
          updated_at: new Date().toISOString(),
        });
        refreshDigest();
        return id;
      },

      updatePerson: (id, data, userId) => {
        const current = get().people.find((p) => p.id === id);
        if (!current) return;
        const merged = normalize({ ...current, ...data, id });
        // The due date follows the cadence unless it was set explicitly.
        if (data.nextDueAt === undefined && (data.cadence || data.intervalDays)) {
          merged.nextDueAt = nextDueFrom(
            merged.lastContactedAt ? new Date(merged.lastContactedAt) : null,
            merged.cadence,
            merged.intervalDays
          ).toISOString();
        }
        set((s) => ({ people: s.people.map((p) => (p.id === id ? merged : p)) }));
        enq('people', 'update', {
          id,
          user_id: userId || null,
          name: merged.name,
          phone: merged.phone || null,
          email: merged.email || null,
          notes: merged.notes || null,
          cadence: merged.cadence,
          interval_days: merged.intervalDays ?? null,
          last_contacted_at: merged.lastContactedAt || null,
          next_due_at: merged.nextDueAt,
          updated_at: new Date().toISOString(),
        });
        refreshDigest();
      },

      deletePerson: (id, userId) => {
        set((s) => ({ people: s.people.filter((p) => p.id !== id) }));
        enq('people', 'delete', { id, user_id: userId || null });
        refreshDigest();
      },

      markContacted: (id, userId) => {
        const current = get().people.find((p) => p.id === id);
        if (!current) return;
        const now = new Date();
        const nextDue = nextDueFrom(now, current.cadence, current.intervalDays);
        const merged: Person = {
          ...current,
          lastContactedAt: now.toISOString(),
          nextDueAt: nextDue.toISOString(),
        };
        set((s) => ({ people: s.people.map((p) => (p.id === id ? merged : p)) }));
        enq('people', 'update', {
          id,
          user_id: userId || null,
          name: merged.name,
          phone: merged.phone || null,
          email: merged.email || null,
          notes: merged.notes || null,
          cadence: merged.cadence,
          interval_days: merged.intervalDays ?? null,
          last_contacted_at: merged.lastContactedAt,
          next_due_at: merged.nextDueAt,
          updated_at: now.toISOString(),
        });
        refreshDigest();
      },

      getDue: (now = new Date()) =>
        get()
          .people.filter((p) => isDue(p.nextDueAt, now))
          .sort((a, b) => daysUntilDue(a.nextDueAt, now) - daysUntilDue(b.nextDueAt, now)),

      getUpcoming: (days = 30, now = new Date()) =>
        get()
          .people.filter((p) => {
            const d = daysUntilDue(p.nextDueAt, now);
            return d > 0 && d <= days;
          })
          .sort((a, b) => daysUntilDue(a.nextDueAt, now) - daysUntilDue(b.nextDueAt, now)),

      getLater: (now = new Date()) =>
        get()
          .people.filter((p) => {
            const d = daysUntilDue(p.nextDueAt, now);
            return d > 30;
          })
          .sort((a, b) => daysUntilDue(a.nextDueAt, now) - daysUntilDue(b.nextDueAt, now)),

      dueCount: (now = new Date()) =>
        get().people.filter((p) => isDue(p.nextDueAt, now) || isOverdue(p.nextDueAt, now)).length,
    }),
    {
      name: 'meridian-people-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
