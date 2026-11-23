/**
 * Notes v2 data model — local mirror of the Supabase `notes_v2` tables.
 *
 * The canonical body format is Markdown with Apple-Notes checklist syntax
 * ("- [ ]" / "- [x]"). Locked-note fields exist in the schema for Phase 2 but
 * are never populated by Phase 1: plain text of a locked note must never enter
 * the local search index, previews, widgets or Supabase.
 */

export const LINK_ENTITY_TYPES = ['task', 'transaction', 'vehicle', 'bill', 'goal'] as const;
export type LinkEntityType = (typeof LINK_ENTITY_TYPES)[number];

export interface Note {
  id: string;
  user_id: string;
  title: string;
  body_md: string;
  folder_id: string | null;
  pinned: boolean;
  pinned_at: string | null;
  locked: boolean;
  cipher_blob: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  device_id: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface NoteTag {
  note_id: string;
  tag_id: string;
}

export interface NoteLink {
  note_id: string;
  entity_type: LinkEntityType;
  entity_id: string;
  /** Set when the linked Meridian item was deleted — the note itself stays. */
  missing: boolean;
}

/** Phase 2 — declared now so the local schema does not need a second migration. */
export interface Attachment {
  id: string;
  note_id: string;
  path: string;
  mime: string;
  size: number;
  created_at: string;
}

export interface NotesState {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  noteTags: NoteTag[];
  noteLinks: NoteLink[];
  recentSearches: string[];
  lastSyncAt: string | null;
  /** Legacy note ids already converted — makes the one-time migration idempotent. */
  migratedLegacyIds: string[];
}

/** Recently deleted retention — 30 days, per spec. */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Pinned notes are capped at 10, always sorted on top. */
export const PIN_LIMIT = 10;
/** Autosave delay after the last keystroke. */
export const AUTOSAVE_MS = 500;
/** FTS query debounce. */
export const SEARCH_DEBOUNCE_MS = 200;

export function emptyNotesState(): NotesState {
  return {
    notes: [],
    folders: [],
    tags: [],
    noteTags: [],
    noteLinks: [],
    recentSearches: [],
    lastSyncAt: null,
    migratedLegacyIds: [],
  };
}
