/**
 * sync — Supabase row mapping, pull/merge and the conflict-copy rule.
 *
 * Conflicts (both sides changed since the last sync) are never resolved by
 * silently dropping text: the newer note wins and the older one is preserved
 * as a new note titled "(conflict) <title>" with a fresh id so queue compaction
 * cannot overwrite it.
 */
import { supabase } from '../../services/supabaseClient';
import { newId } from './id';
import { titleFromBody } from './markdown';
import type { SyncEvent } from './repository';
import {
  Note, Folder, Tag, NoteTag, NoteLink, NotesState, LinkEntityType,
} from './types';

type Row = Record<string, any>;

export function noteToRow(note: Note, userId?: string): Row {
  return {
    id: note.id,
    user_id: userId ?? note.user_id,
    title: note.title,
    body_md: note.body_md,
    folder_id: note.folder_id,
    pinned: note.pinned,
    pinned_at: note.pinned_at,
    locked: note.locked,
    cipher_blob: note.cipher_blob,
    created_at: note.created_at,
    updated_at: note.updated_at,
    deleted_at: note.deleted_at,
    version: note.version,
    device_id: note.device_id,
  };
}

export function rowToNote(row: Row): Note {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ''),
    title: String(row.title ?? titleFromBody(String(row.body_md ?? ''))),
    body_md: String(row.body_md ?? ''),
    folder_id: row.folder_id ? String(row.folder_id) : null,
    pinned: Boolean(row.pinned),
    pinned_at: row.pinned_at ? String(row.pinned_at) : null,
    locked: Boolean(row.locked),
    cipher_blob: row.cipher_blob ? String(row.cipher_blob) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
    version: Number(row.version ?? 1),
    device_id: String(row.device_id ?? ''),
  };
}

export function folderToRow(f: Folder, userId?: string): Row {
  return {
    id: f.id, user_id: userId ?? f.user_id, name: f.name, color: f.color,
    sort: f.sort, created_at: f.created_at, updated_at: f.updated_at, deleted_at: f.deleted_at,
  };
}

export function rowToFolder(r: Row): Folder {
  return {
    id: String(r.id), user_id: String(r.user_id ?? ''), name: String(r.name ?? 'Untitled'),
    color: r.color ? String(r.color) : null, sort: Number(r.sort ?? 0),
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
    deleted_at: r.deleted_at ? String(r.deleted_at) : null,
  };
}

export function tagToRow(t: Tag, userId?: string): Row {
  return { id: t.id, user_id: userId ?? t.user_id, name: t.name };
}
export function rowToTag(r: Row): Tag {
  return { id: String(r.id), user_id: String(r.user_id ?? ''), name: String(r.name ?? '') };
}

export function noteTagToRow(n: NoteTag): Row {
  return { note_id: n.note_id, tag_id: n.tag_id };
}
export function rowToNoteTag(r: Row): NoteTag {
  return { note_id: String(r.note_id), tag_id: String(r.tag_id) };
}

export function noteLinkToRow(l: NoteLink): Row {
  return { note_id: l.note_id, entity_type: l.entity_type, entity_id: l.entity_id, missing: l.missing };
}
export function rowToNoteLink(r: Row): NoteLink {
  return {
    note_id: String(r.note_id),
    entity_type: String(r.entity_type) as LinkEntityType,
    entity_id: String(r.entity_id),
    missing: Boolean(r.missing),
  };
}

export interface ConflictResult { kept: Note; copy: Note | null }

/**
 * Last-write-wins by updated_at. If BOTH sides changed since the last sync on
 * different devices, keep the newer and clone the older as a conflict copy.
 */
export function resolveConflict(
  local: Note, remote: Note, lastSyncAt: string | null, now: string, deviceId: string
): ConflictResult {
  const localMs = Date.parse(local.updated_at);
  const remoteMs = Date.parse(remote.updated_at);
  const syncMs = lastSyncAt ? Date.parse(lastSyncAt) : NaN;
  const bothChanged = Number.isFinite(syncMs)
    && localMs > syncMs
    && remoteMs > syncMs
    && local.device_id !== remote.device_id;

  if (bothChanged) {
    const newer = localMs >= remoteMs ? local : remote;
    const older = localMs >= remoteMs ? remote : local;
    const copy: Note = {
      ...older,
      id: newId(),
      title: `(conflict) ${older.title}`,
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      pinned: false,
      pinned_at: null,
      device_id: deviceId,
    };
    return { kept: newer, copy };
  }
  return { kept: remoteMs > localMs ? remote : local, copy: null };
}

/** Merge a cloud pull into local state, producing events for any conflict copies. */
export function mergeRemoteNotes(
  state: NotesState, remoteNotes: Note[], now: string, deviceId: string
): { state: NotesState; events: SyncEvent[] } {
  let notes = [...state.notes];
  const events: SyncEvent[] = [];

  for (const remote of remoteNotes) {
    const idx = notes.findIndex((n) => n.id === remote.id);
    if (idx === -1) {
      notes.push(remote);
      continue;
    }
    const { kept, copy } = resolveConflict(notes[idx], remote, state.lastSyncAt, now, deviceId);
    notes[idx] = kept;
    if (copy) {
      notes.push(copy);
      events.push({ entity: 'note', action: 'create', data: noteToRow(copy) });
    }
  }
  return { state: { ...state, notes }, events };
}

function mergeById<T extends { id: string }>(local: T[], remote: T[], timeOf: (t: T) => string): T[] {
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const incoming of remote) {
    const current = byId.get(incoming.id);
    if (!current || timeOf(incoming) > timeOf(current)) byId.set(incoming.id, incoming);
  }
  return [...byId.values()];
}

/** Pull all five synced tables and merge. Never throws on a single table error. */
export async function pullAndMerge(
  userId: string, state: NotesState, deviceId: string
): Promise<{ state: NotesState; events: SyncEvent[] }> {
  const [notesRes, foldersRes, tagsRes, noteTagsRes, noteLinksRes] = await Promise.all([
    supabase.from('note').select('*').eq('user_id', userId),
    supabase.from('folder').select('*').eq('user_id', userId),
    supabase.from('tag').select('*').eq('user_id', userId),
    supabase.from('note_tag').select('*'),
    supabase.from('note_link').select('*'),
  ]);

  const now = new Date().toISOString();
  let next: NotesState = { ...state };
  let events: SyncEvent[] = [];

  if (!notesRes.error && Array.isArray(notesRes.data)) {
    const merged = mergeRemoteNotes(next, (notesRes.data as Row[]).map(rowToNote), now, deviceId);
    next = merged.state;
    events = events.concat(merged.events);
  }
  if (!foldersRes.error && Array.isArray(foldersRes.data)) {
    const remote = (foldersRes.data as Row[]).map(rowToFolder);
    next = { ...next, folders: mergeById(next.folders, remote, (f) => f.updated_at) };
  }
  if (!tagsRes.error && Array.isArray(tagsRes.data)) {
    const remote = (tagsRes.data as Row[]).map(rowToTag);
    const byId = new Map(next.tags.map((t) => [t.id, t]));
    for (const tag of remote) byId.set(tag.id, tag);
    next = { ...next, tags: [...byId.values()] };
  }

  // Junction tables are unioned by key; note_link.missing is a field, not a delete.
  const visibleNoteIds = new Set((next.notes as Note[]).map((n) => n.id));
  if (!noteTagsRes.error && Array.isArray(noteTagsRes.data)) {
    const key = (n: NoteTag) => `${n.note_id}|${n.tag_id}`;
    const byKey = new Map(next.noteTags.map((n) => [key(n), n]));
    for (const r of noteTagsRes.data as Row[]) {
      const item = rowToNoteTag(r);
      if (visibleNoteIds.has(item.note_id)) byKey.set(key(item), item);
    }
    next = { ...next, noteTags: [...byKey.values()] };
  }
  if (!noteLinksRes.error && Array.isArray(noteLinksRes.data)) {
    const key = (l: NoteLink) => `${l.note_id}|${l.entity_type}|${l.entity_id}`;
    const byKey = new Map(next.noteLinks.map((l) => [key(l), l]));
    for (const r of noteLinksRes.data as Row[]) {
      const item = rowToNoteLink(r);
      if (visibleNoteIds.has(item.note_id)) byKey.set(key(item), item);
    }
    next = { ...next, noteLinks: [...byKey.values()] };
  }

  return { state: { ...next, lastSyncAt: now }, events };
}
