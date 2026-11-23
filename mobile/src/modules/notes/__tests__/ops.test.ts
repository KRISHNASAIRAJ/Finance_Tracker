import {
  addLink, createFolder, createNote, deleteFolder, ensureTag, folderCounts,
  markMissingLinks, moveNote, normalizeState, purgeExpired, purgeNote,
  restoreNote, setNoteTags, togglePin, trashNote, updateNoteBody,
} from '../ops';
import { emptyNotesState, Note, NotesState, PIN_LIMIT, TRASH_TTL_MS } from '../types';

const NOW = '2026-11-23T02:00:00.000Z';
const DEVICE = 'device-a';

function makeNote(id: string, extra: Partial<Note> = {}): Note {
  return {
    id, user_id: 'u1', title: 'Note', body_md: 'Note\n\nbody', folder_id: null,
    pinned: false, pinned_at: null, locked: false, cipher_blob: null,
    created_at: NOW, updated_at: NOW, deleted_at: null, version: 1, device_id: DEVICE,
    ...extra,
  };
}

function withNotes(notes: Note[], extra: Partial<NotesState> = {}): NotesState {
  return normalizeState({ ...emptyNotesState(), notes, ...extra });
}

describe('create and update', () => {
  it('derives the title from the first line and versions the note', () => {
    const created = createNote(emptyNotesState(), {
      userId: 'u1', deviceId: DEVICE, now: NOW, bodyMd: 'Hello\n\nWorld',
    });
    expect(created.note.title).toBe('Hello');
    expect(created.note.version).toBe(1);
    expect(created.state.notes).toHaveLength(1);

    const updated = updateNoteBody(created.state, created.note.id, 'New title\n\nWorld', NOW, DEVICE);
    expect(updated.notes[0].title).toBe('New title');
    expect(updated.notes[0].version).toBe(2);
  });

  it('never edits a locked note body', () => {
    const state = withNotes([makeNote('n1', { locked: true, cipher_blob: 'cipher' })]);
    const updated = updateNoteBody(state, 'n1', 'plain text', NOW, DEVICE);
    expect(updated.notes[0].body_md).toBe('Note\n\nbody');
  });

  it('moves a note to a folder', () => {
    const state = withNotes([makeNote('n1')]);
    expect(moveNote(state, 'n1', 'f1', NOW, DEVICE).notes[0].folder_id).toBe('f1');
  });
});

describe('trash and restore', () => {
  it('trashes into Recently deleted, releases the pin, and restores keeping the folder', () => {
    const state = withNotes([makeNote('n1', { pinned: true, pinned_at: NOW, folder_id: 'f1' })]);
    const trashed = trashNote(state, 'n1', NOW, DEVICE);
    expect(trashed.notes[0].deleted_at).toBe(NOW);
    expect(trashed.notes[0].pinned).toBe(false);
    expect(folderCounts(trashed).__trash).toBe(1);

    const restored = restoreNote(trashed, 'n1', NOW, DEVICE);
    expect(restored.notes[0].deleted_at).toBeNull();
    expect(restored.notes[0].folder_id).toBe('f1');
  });

  it('purges a note and its tags/links', () => {
    const state = withNotes([makeNote('n1')], {
      noteTags: [{ note_id: 'n1', tag_id: 't1' }],
      noteLinks: [{ note_id: 'n1', entity_type: 'task', entity_id: 'x', missing: false }],
    });
    const purged = purgeNote(state, 'n1');
    expect(purged.notes).toHaveLength(0);
    expect(purged.noteTags).toHaveLength(0);
    expect(purged.noteLinks).toHaveLength(0);
  });

  it('purges only notes older than 30 days', () => {
    const old = makeNote('old', { deleted_at: new Date(Date.now() - TRASH_TTL_MS - 1000).toISOString() });
    const fresh = makeNote('fresh', { deleted_at: new Date(Date.now() - 1000).toISOString() });
    const purged = purgeExpired(withNotes([old, fresh]));
    expect(purged.notes.map((n) => n.id)).toEqual(['fresh']);
  });
});

describe('pinning', () => {
  it('caps pinned notes at 10 and releases the oldest pin', () => {
    let state = withNotes(Array.from({ length: 12 }, (_, i) => makeNote(`n${i}`)));
    for (let i = 0; i < 12; i++) {
      state = togglePin(state, `n${i}`, new Date(Date.parse(NOW) + i * 1000).toISOString(), DEVICE);
    }
    expect(state.notes.filter((n) => n.pinned)).toHaveLength(PIN_LIMIT);
    expect(state.notes.find((n) => n.id === 'n0')?.pinned).toBe(false);
    expect(state.notes.find((n) => n.id === 'n11')?.pinned).toBe(true);
  });

  it('unpinning clears pinned_at', () => {
    const state = withNotes([makeNote('n1', { pinned: true, pinned_at: NOW })]);
    expect(togglePin(state, 'n1', NOW, DEVICE).notes[0].pinned_at).toBeNull();
  });
});

describe('folders, tags and links', () => {
  it('counts alive notes by folder and keeps Recently deleted separate', () => {
    const state = withNotes([
      makeNote('n1', { folder_id: 'f1' }),
      makeNote('n2', { folder_id: 'f1' }),
      makeNote('n3', { folder_id: 'f2' }),
      makeNote('n4', { deleted_at: NOW }),
    ]);
    const counts = folderCounts(state);
    expect(counts.__all).toBe(3);
    expect(counts.f1).toBe(2);
    expect(counts.__trash).toBe(1);
  });

  it('deleting a folder clears the note folder id but keeps the note', () => {
    const created = createFolder(withNotes([makeNote('n1', { folder_id: 'f1' })]), {
      name: 'Work', userId: 'u1', now: NOW,
    });
    const noteInFolder = { ...created.state.notes[0], folder_id: created.folder.id };
    const state = { ...created.state, notes: [noteInFolder] };
    const after = deleteFolder(state, created.folder.id);
    expect(after.notes[0].folder_id).toBeNull();
    expect(after.notes[0].body_md).toBe('Note\n\nbody');
  });

  it('reuses a tag case-insensitively and replaces note tags', () => {
    const first = ensureTag(emptyNotesState(), 'Money', 'u1');
    const second = ensureTag(first.state, '#money', 'u1');
    expect(second.tag.id).toBe(first.tag.id);
    const tagged = setNoteTags(second.state, 'n1', [second.tag.id]);
    expect(tagged.noteTags).toEqual([{ note_id: 'n1', tag_id: first.tag.id }]);
    expect(setNoteTags(tagged, 'n1', []).noteTags).toHaveLength(0);
  });

  it('marks a link missing when the target disappears but keeps the note', () => {
    let state = addLink(withNotes([makeNote('n1')]), 'n1', 'task', 'task-1');
    expect(state.noteLinks[0].missing).toBe(false);
    // re-adding the same link is a no-op
    state = addLink(state, 'n1', 'task', 'task-1');
    expect(state.noteLinks).toHaveLength(1);
    state = markMissingLinks(state, 'task', new Set());
    expect(state.noteLinks[0].missing).toBe(true);
    expect(state.notes).toHaveLength(1);
  });
});
