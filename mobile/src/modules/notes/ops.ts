/**
 * ops — pure state transitions for Notes v2.
 *
 * Every function returns a NEW NotesState so the Zustand store stays immutable
 * and each rule can be unit-tested without AsyncStorage or Supabase.
 */
import { newId } from './id';
import { titleFromBody } from './markdown';
import {
  Note, Folder, Tag, NoteLink, LinkEntityType, NotesState,
  PIN_LIMIT, TRASH_TTL_MS,
} from './types';

export function normalizeState(state: NotesState): NotesState {
  return {
    notes: state.notes ?? [],
    folders: state.folders ?? [],
    tags: state.tags ?? [],
    noteTags: state.noteTags ?? [],
    noteLinks: state.noteLinks ?? [],
    recentSearches: state.recentSearches ?? [],
    lastSyncAt: state.lastSyncAt ?? null,
    migratedLegacyIds: state.migratedLegacyIds ?? [],
  };
}

function bump(note: Note, now: string, deviceId: string, patch: Partial<Note>): Note {
  return {
    ...note,
    ...patch,
    title: patch.body_md !== undefined && !note.locked ? titleFromBody(patch.body_md) : note.title,
    version: note.version + 1,
    updated_at: now,
    device_id: deviceId,
  };
}

export interface CreateNoteInput {
  bodyMd?: string;
  folderId?: string | null;
  userId: string;
  deviceId: string;
  now?: string;
}

export function createNote(state: NotesState, input: CreateNoteInput): { state: NotesState; note: Note } {
  const now = input.now ?? new Date().toISOString();
  const bodyMd = input.bodyMd ?? '';
  const note: Note = {
    id: newId(),
    user_id: input.userId,
    title: titleFromBody(bodyMd),
    body_md: bodyMd,
    folder_id: input.folderId ?? null,
    pinned: false,
    pinned_at: null,
    locked: false,
    cipher_blob: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    device_id: input.deviceId,
  };
  return { state: { ...state, notes: [note, ...state.notes] }, note };
}

/** Title/preview rule: body is canonical; title is derived from line 1. */
export function updateNoteBody(
  state: NotesState, id: string, bodyMd: string, now: string, deviceId: string
): NotesState {
  return {
    ...state,
    notes: state.notes.map((n) => n.id === id && !n.locked ? bump(n, now, deviceId, { body_md: bodyMd }) : n),
  };
}

export function trashNote(state: NotesState, id: string, now: string, deviceId: string): NotesState {
  return {
    ...state,
    notes: state.notes.map((n) =>
      n.id === id ? bump(n, now, deviceId, { deleted_at: now, pinned: false, pinned_at: null }) : n),
  };
}

/** Restore keeps the original folder. */
export function restoreNote(state: NotesState, id: string, now: string, deviceId: string): NotesState {
  return {
    ...state,
    notes: state.notes.map((n) => n.id === id ? bump(n, now, deviceId, { deleted_at: null }) : n),
  };
}

export function purgeNote(state: NotesState, id: string): NotesState {
  return {
    ...state,
    notes: state.notes.filter((n) => n.id !== id),
    noteTags: state.noteTags.filter((nt) => nt.note_id !== id),
    noteLinks: state.noteLinks.filter((nl) => nl.note_id !== id),
  };
}

/** 30-day Recently Deleted purge. */
export function purgeExpired(state: NotesState, nowMs: number = Date.now()): NotesState {
  let next = state;
  for (const note of state.notes) {
    if (!note.deleted_at) continue;
    if (nowMs - new Date(note.deleted_at).getTime() >= TRASH_TTL_MS) {
      next = purgeNote(next, note.id);
    }
  }
  return next;
}

/** Pinned always on top, capped at PIN_LIMIT (oldest pin is released). */
export function togglePin(state: NotesState, id: string, now: string, deviceId: string): NotesState {
  const target = state.notes.find((n) => n.id === id);
  if (!target) return state;
  const willPin = !target.pinned;
  let notes = state.notes.map((n) =>
    n.id === id ? bump(n, now, deviceId, { pinned: willPin, pinned_at: willPin ? now : null }) : n);

  if (willPin) {
    const pinned = notes.filter((n) => n.pinned && !n.deleted_at);
    if (pinned.length > PIN_LIMIT) {
      const oldest = pinned
        .filter((n) => n.id !== id)
        .sort((a, b) => (a.pinned_at ?? '').localeCompare(b.pinned_at ?? ''))[0];
      if (oldest) {
        notes = notes.map((n) =>
          n.id === oldest.id ? bump(n, now, deviceId, { pinned: false, pinned_at: null }) : n);
      }
    }
  }
  return { ...state, notes };
}

export function moveNote(
  state: NotesState, id: string, folderId: string | null, now: string, deviceId: string
): NotesState {
  return {
    ...state,
    notes: state.notes.map((n) => n.id === id ? bump(n, now, deviceId, { folder_id: folderId }) : n),
  };
}

export interface CreateFolderInput {
  name: string;
  userId: string;
  color?: string | null;
  sort?: number;
  now?: string;
}

export function createFolder(state: NotesState, input: CreateFolderInput): { state: NotesState; folder: Folder } {
  const now = input.now ?? new Date().toISOString();
  const folder: Folder = {
    id: newId(),
    user_id: input.userId,
    name: input.name.trim() || 'Untitled',
    color: input.color ?? null,
    sort: input.sort ?? state.folders.length,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  return { state: { ...state, folders: [...state.folders, folder] }, folder };
}

export function renameFolder(state: NotesState, id: string, name: string, now: string): NotesState {
  return {
    ...state,
    folders: state.folders.map((f) => f.id === id ? { ...f, name: name.trim(), updated_at: now } : f),
  };
}

export function deleteFolder(state: NotesState, id: string): NotesState {
  // Notes survive with folder_id cleared — never delete note content with a folder.
  return {
    ...state,
    folders: state.folders.filter((f) => f.id !== id),
    notes: state.notes.map((n) => n.folder_id === id ? { ...n, folder_id: null } : n),
  };
}

export function ensureTag(state: NotesState, name: string, userId: string): { state: NotesState; tag: Tag } {
  const clean = name.trim().replace(/^#/, '');
  const existing = state.tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { state, tag: existing };
  const tag: Tag = { id: newId(), user_id: userId, name: clean };
  return { state: { ...state, tags: [...state.tags, tag] }, tag };
}

export function setNoteTags(state: NotesState, noteId: string, tagIds: string[]): NotesState {
  return {
    ...state,
    noteTags: [
      ...state.noteTags.filter((nt) => nt.note_id !== noteId),
      ...tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId })),
    ],
  };
}

export function addLink(
  state: NotesState, noteId: string, entityType: LinkEntityType, entityId: string
): NotesState {
  const exists = state.noteLinks.some(
    (l) => l.note_id === noteId && l.entity_type === entityType && l.entity_id === entityId
  );
  if (exists) return state;
  const link: NoteLink = { note_id: noteId, entity_type: entityType, entity_id: entityId, missing: false };
  return { ...state, noteLinks: [...state.noteLinks, link] };
}

/** Deleting the target keeps the note and marks the link missing. */
export function markMissingLinks(
  state: NotesState, entityType: LinkEntityType, existingIds: Set<string>
): NotesState {
  return {
    ...state,
    noteLinks: state.noteLinks.map((l) =>
      l.entity_type === entityType && !existingIds.has(l.entity_id) ? { ...l, missing: true } : l),
  };
}

export function folderCounts(state: NotesState): Record<string, number> {
  const counts: Record<string, number> = { __all: 0, __trash: 0 };
  for (const note of state.notes) {
    if (note.deleted_at) {
      counts.__trash++;
      continue;
    }
    counts.__all++;
    const key = note.folder_id ?? '__none';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
