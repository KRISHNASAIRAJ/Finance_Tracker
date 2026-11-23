/**
 * migration — one-time, idempotent conversion of the legacy Personal Notes
 * into Notes v2. Backup is written and verified BEFORE any state is changed;
 * rollback restores from that snapshot.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePersonalStore } from '../personal/store';
import { newId } from './id';
import { loadState, persist, NOTES_V2_STORAGE_KEY, type SyncEvent } from './repository';
import { folderToRow, noteToRow } from './sync';
import { Folder, Note, NotesState } from './types';

export const NOTES_V2_MIGRATED_KEY = 'notes_v2_migrated_at';
export const NOTES_V2_BACKUP_KEY = 'notes_v2_migration_backup';

/** Structural type of the old note — avoids importing the full personal store type here. */
export interface LegacyNoteLike {
  id: string;
  title: string;
  content: string;
  date: string;
  folder?: string;
  pinned?: boolean;
  deletedAt?: string | null;
}

export interface NotesBackup {
  createdAt: string;
  legacyNotes: LegacyNoteLike[];
}

async function verifiedWrite(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
  const written = await AsyncStorage.getItem(key);
  if (written !== value) throw new Error('[NotesMigration] backup verification failed');
}

/** Write a full app backup plus a dedicated notes snapshot. Call before migrating. */
export async function createMigrationBackup(): Promise<NotesBackup> {
  try {
    const { exportAllData } = require('../../services/backupService');
    await exportAllData();
  } catch (e) {
    console.warn('[NotesMigration] full backup unavailable, using notes snapshot only:', e);
  }

  const legacyNotes = (usePersonalStore.getState().notes ?? []) as LegacyNoteLike[];
  const backup: NotesBackup = { createdAt: new Date().toISOString(), legacyNotes };
  await verifiedWrite(NOTES_V2_BACKUP_KEY, JSON.stringify(backup));
  return backup;
}

export interface LegacyMapping {
  note: Note;
  folder: Folder | null;
  folderName: string | null;
}

/** Old note → new note. Title becomes line 1 of body_md; folder string becomes a folder row. */
export function mapLegacyNote(
  legacy: LegacyNoteLike, userId: string, deviceId: string, now: string
): LegacyMapping {
  const bodyMd = `${(legacy.title || '').trim() || 'New Note'}\n\n${(legacy.content || '').trim()}`.trimEnd();
  const folderName = legacy.folder && legacy.folder !== 'Notes' ? legacy.folder : null;
  const note: Note = {
    // Keep the legacy id: migration is idempotent by id and rollback can
    // recognise migrated notes in the snapshot.
    id: legacy.id,
    user_id: userId,
    title: legacy.title || 'New Note',
    body_md: bodyMd,
    folder_id: folderName ? newId() : null,
    pinned: Boolean(legacy.pinned),
    pinned_at: legacy.pinned ? (legacy.date || now) : null,
    locked: false,
    cipher_blob: null,
    created_at: legacy.date || now,
    updated_at: legacy.date || now,
    deleted_at: legacy.deletedAt ?? null,
    version: 1,
    device_id: deviceId,
  };

  let folder: Folder | null = null;
  if (folderName && note.folder_id) {
    folder = {
      id: note.folder_id,
      user_id: userId,
      name: folderName,
      color: null,
      sort: 0,
      created_at: legacy.date || now,
      updated_at: legacy.date || now,
      deleted_at: null,
    };
  }
  return { note, folder, folderName };
}

/** Reverse mapping used if the flag is turned off after notes were created in v2. */
export function mapV2ToLegacy(note: Note): LegacyNoteLike {
  const lines = note.body_md.split('\n');
  const title = lines[0]?.trim() || note.title || 'New Note';
  const content = lines.slice(1).join('\n').replace(/^\n+/, '').trimEnd();
  return {
    id: note.id,
    title,
    content,
    date: note.created_at,
    // folder name is filled by the caller (v2 stores a folder id)
    pinned: note.pinned,
    deletedAt: note.deleted_at,
  };
}

/** Pure, idempotent plan: ids already migrated are skipped. */
export function planMigration(
  legacyNotes: LegacyNoteLike[], state: NotesState, userId: string, deviceId: string, now: string
): { state: NotesState; events: SyncEvent[] } {
  const done = new Set(state.migratedLegacyIds ?? []);
  let next: NotesState = { ...state, notes: [...state.notes], folders: [...state.folders] };
  const events: SyncEvent[] = [];
  const folderByName = new Map(next.folders.filter((f) => !f.deleted_at).map((f) => [f.name.toLowerCase(), f]));

  for (const legacy of legacyNotes) {
    if (done.has(legacy.id)) continue;
    const mapped = mapLegacyNote(legacy, userId, deviceId, now);

    if (mapped.folderName) {
      const existing = folderByName.get(mapped.folderName.toLowerCase());
      if (existing) {
        mapped.note.folder_id = existing.id;
      } else if (mapped.folder) {
        next.folders.push(mapped.folder);
        folderByName.set(mapped.folderName.toLowerCase(), mapped.folder);
        events.push({ entity: 'folder', action: 'create', data: folderToRow(mapped.folder, userId) });
      }
    }

    next.notes.push(mapped.note);
    events.push({ entity: 'note', action: 'create', data: noteToRow(mapped.note, userId) });
    done.add(legacy.id);
  }

  next.migratedLegacyIds = [...done];
  return { state: next, events };
}

/** Full orchestration. Never called automatically until the flag is enabled. */
export async function runMigration(userId: string, deviceId: string): Promise<void> {
  await createMigrationBackup();
  const marker = await AsyncStorage.getItem(NOTES_V2_MIGRATED_KEY);
  if (marker) return;

  const legacyNotes = (usePersonalStore.getState().notes ?? []) as LegacyNoteLike[];
  const current = await loadState();
  const { state, events } = planMigration(legacyNotes, current, userId, deviceId, new Date().toISOString());
  await persist(state, events);
  await verifiedWrite(NOTES_V2_MIGRATED_KEY, new Date().toISOString());
}

/**
 * Restore the legacy slice from the verified snapshot. V2-only notes created
 * since the migration are reverse-mapped so their text survives the rollback.
 */
export async function rollbackMigration(): Promise<void> {
  const raw = await AsyncStorage.getItem(NOTES_V2_BACKUP_KEY);
  if (!raw) throw new Error('[NotesMigration] no backup to roll back to');
  const backup = JSON.parse(raw) as NotesBackup;
  const v2 = await loadState();
  const restored = new Map<string, LegacyNoteLike>(
    backup.legacyNotes.map((n) => [n.id, n])
  );
  const folderName = new Map(v2.folders.map((f) => [f.id, f.name]));
  for (const note of v2.notes) {
    if (note.deleted_at) continue;
    if (!restored.has(note.id)) {
      const legacy = mapV2ToLegacy(note);
      legacy.folder = note.folder_id ? (folderName.get(note.folder_id) ?? undefined) : undefined;
      restored.set(note.id, legacy);
    }
  }
  // Cast: the target store still holds the legacy Note shape.
  usePersonalStore.setState({ notes: [...restored.values()] as any });
  await AsyncStorage.removeItem(NOTES_V2_STORAGE_KEY);
  await AsyncStorage.removeItem(NOTES_V2_MIGRATED_KEY);
}

/** True when the one-time migration marker exists. */
export async function isMigrationDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTES_V2_MIGRATED_KEY)) !== null;
}

/** Exposed for tests / debug: reset notes-v2 state without touching the backup. */
export async function resetNotesV2State(): Promise<void> {
  await AsyncStorage.removeItem(NOTES_V2_STORAGE_KEY);
  await AsyncStorage.removeItem(NOTES_V2_MIGRATED_KEY);
}
