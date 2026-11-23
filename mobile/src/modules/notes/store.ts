/**
 * notesStore — Zustand store for Notes v2. Every action mutates local state
 * first and only then persists + enqueues sync rows.
 */
import { create } from 'zustand';

import { loadState, persist, type SyncEvent } from './repository';
import * as ops from './ops';
import { addRecentSearch, buildIndex, searchNotes } from './search';
import { pullAndMerge, folderToRow, noteToRow, tagToRow, noteLinkToRow } from './sync';
import { createMigrationBackup, planMigration, runMigration } from './migration';
import {
  emptyNotesState, Note, NotesState, LinkEntityType,
} from './types';

interface NotesV2State extends NotesState {
  hydrated: boolean;
  userId: string;
  deviceId: string;
  initialize: (userId: string, deviceId: string) => Promise<void>;
  create: (bodyMd?: string, folderId?: string | null) => Promise<Note>;
  updateBody: (id: string, bodyMd: string) => Promise<void>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
  purgeExpired: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  move: (id: string, folderId: string | null) => Promise<void>;
  addFolder: (name: string) => Promise<string>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  addTag: (noteId: string, name: string) => Promise<void>;
  removeTags: (noteId: string) => Promise<void>;
  addLink: (noteId: string, type: LinkEntityType, entityId: string) => Promise<void>;
  markLinksMissing: (type: LinkEntityType, existingIds: Set<string>) => Promise<void>;
  rememberSearch: (query: string) => void;
  search: (query: string) => Note[];
  syncNow: () => Promise<void>;
  backup: () => Promise<void>;
  migrate: () => Promise<void>;
  migratePlanOnly: (legacy: Array<any>) => Promise<void>;
}

export const useNotesStore = create<NotesV2State>()((set, get) => {
  const commit = async (next: NotesState, events: SyncEvent[] = []) => {
    set(next as Partial<NotesV2State>);
    await persist(next, events);
  };

  return {
    ...emptyNotesState(),
    hydrated: false,
    userId: '',
    deviceId: '',

    initialize: async (userId, deviceId) => {
      const loaded = await loadState();
      set({ ...loaded, userId, deviceId, hydrated: true });
    },

    create: async (bodyMd = '', folderId = null) => {
      const { userId, deviceId } = get();
      const { state, note } = ops.createNote(get(), { userId, deviceId, bodyMd, folderId });
      await commit(state, [{ entity: 'note', action: 'create', data: noteToRow(note, userId) }]);
      return note;
    },

    updateBody: async (id, bodyMd) => {
      const { userId, deviceId } = get();
      const next = ops.updateNoteBody(get(), id, bodyMd, new Date().toISOString(), deviceId);
      const note = next.notes.find((n) => n.id === id);
      await commit(next, note ? [{ entity: 'note', action: 'create', data: noteToRow(note, userId) }] : []);
    },

    trash: async (id) => {
      const { userId, deviceId } = get();
      const next = ops.trashNote(get(), id, new Date().toISOString(), deviceId);
      const note = next.notes.find((n) => n.id === id);
      await commit(next, note ? [{ entity: 'note', action: 'create', data: noteToRow(note, userId) }] : []);
    },

    restore: async (id) => {
      const { userId, deviceId } = get();
      const next = ops.restoreNote(get(), id, new Date().toISOString(), deviceId);
      const note = next.notes.find((n) => n.id === id);
      await commit(next, note ? [{ entity: 'note', action: 'create', data: noteToRow(note, userId) }] : []);
    },

    purge: async (id) => {
      await commit(ops.purgeNote(get(), id), [
        { entity: 'note', action: 'delete', data: { id, user_id: get().userId || null } },
      ]);
    },

    purgeExpired: async () => {
      await commit(ops.purgeExpired(get()));
    },

    togglePin: async (id) => {
      const { userId, deviceId } = get();
      const before = get().notes.find((n) => n.id === id);
      const next = ops.togglePin(get(), id, new Date().toISOString(), deviceId);
      const events: SyncEvent[] = [];
      const after = next.notes.find((n) => n.id === id);
      if (after) events.push({ entity: 'note', action: 'create', data: noteToRow(after, userId) });
      if (before?.pinned && !after?.pinned) {
        // release is already reflected in after
      }
      const unpinned = next.notes.filter(
        (n) => before?.pinned && n.pinned === false && get().notes.find((x) => x.id === n.id)?.pinned
      );
      for (const n of unpinned) events.push({ entity: 'note', action: 'create', data: noteToRow(n, userId) });
      await commit(next, events);
    },

    move: async (id, folderId) => {
      const { userId, deviceId } = get();
      const next = ops.moveNote(get(), id, folderId, new Date().toISOString(), deviceId);
      const note = next.notes.find((n) => n.id === id);
      await commit(next, note ? [{ entity: 'note', action: 'create', data: noteToRow(note, userId) }] : []);
    },

    addFolder: async (name) => {
      const { userId } = get();
      const { state, folder } = ops.createFolder(get(), { name, userId });
      await commit(state, [{ entity: 'folder', action: 'create', data: folderToRow(folder, userId) }]);
      return folder.id;
    },

    renameFolder: async (id, name) => {
      const { userId } = get();
      const next = ops.renameFolder(get(), id, name, new Date().toISOString());
      const folder = next.folders.find((f) => f.id === id);
      await commit(next, folder ? [{ entity: 'folder', action: 'create', data: folderToRow(folder, userId) }] : []);
    },

    deleteFolder: async (id) => {
      const { userId } = get();
      const next = ops.deleteFolder(get(), id);
      const events: SyncEvent[] = [
        { entity: 'folder', action: 'delete', data: { id, user_id: userId || null } },
      ];
      for (const note of next.notes.filter((n) => n.folder_id === null)) {
        if (get().notes.find((x) => x.id === note.id)?.folder_id === id) {
          events.push({ entity: 'note', action: 'create', data: noteToRow(note, userId) });
        }
      }
      await commit(next, events);
    },

    addTag: async (noteId, name) => {
      const { userId } = get();
      const withTag = ops.ensureTag(get(), name, userId);
      const next = ops.setNoteTags(withTag.state, noteId, [
        ...withTag.state.noteTags.filter((nt) => nt.note_id === noteId).map((nt) => nt.tag_id),
        withTag.tag.id,
      ]);
      const events: SyncEvent[] = [];
      if (withTag.tag !== get().tags.find((t) => t.id === withTag.tag.id)) {
        events.push({ entity: 'tag', action: 'create', data: tagToRow(withTag.tag, userId) });
      }
      const link = next.noteTags.find((nt) => nt.note_id === noteId && nt.tag_id === withTag.tag.id);
      if (link) events.push({ entity: 'note_tag', action: 'create', data: { note_id: link.note_id, tag_id: link.tag_id } });
      await commit(next, events);
    },

    removeTags: async (noteId) => {
      const next = ops.setNoteTags(get(), noteId, []);
      const removed = get().noteTags.filter((nt) => nt.note_id === noteId);
      await commit(next, removed.map((nt) => ({
        entity: 'note_tag', action: 'delete' as const, data: { note_id: nt.note_id, tag_id: nt.tag_id },
      })));
    },

    addLink: async (noteId, type, entityId) => {
      const { userId } = get();
      const next = ops.addLink(get(), noteId, type, entityId);
      const link = next.noteLinks.find(
        (l) => l.note_id === noteId && l.entity_type === type && l.entity_id === entityId
      );
      await commit(next, link ? [{ entity: 'note_link', action: 'create', data: noteLinkToRow(link) }] : []);
      void userId;
    },

    markLinksMissing: async (type, existingIds) => {
      const next = ops.markMissingLinks(get(), type, existingIds);
      const changed = next.noteLinks.filter((l) => {
        const before = get().noteLinks.find(
          (x) => x.note_id === l.note_id && x.entity_type === l.entity_type && x.entity_id === l.entity_id
        );
        return l.missing && !before?.missing;
      });
      await commit(next, changed.map((l) => ({
        entity: 'note_link', action: 'create' as const, data: noteLinkToRow(l),
      })));
    },

    rememberSearch: (query) => set({ recentSearches: addRecentSearch(get().recentSearches, query) }),

    search: (query) => {
      const state = get();
      return searchNotes(query, state, buildIndex(state));
    },

    syncNow: async () => {
      const { userId, deviceId } = get();
      if (!userId) return;
      const merged = await pullAndMerge(userId, get(), deviceId);
      await persist(merged.state, merged.events);
      set(merged.state as Partial<NotesV2State>);
    },

    backup: async () => { await createMigrationBackup(); },

    migrate: async () => {
      const { userId, deviceId } = get();
      await runMigration(userId, deviceId);
      const loaded = await loadState();
      set(loaded as Partial<NotesV2State>);
    },

    migratePlanOnly: async (legacy) => {
      const { userId, deviceId } = get();
      const { state, events } = planMigration(legacy, get(), userId, deviceId, new Date().toISOString());
      await commit(state, events);
    },
  };
});
