jest.mock('../../../services/supabaseClient', () => ({ supabase: {} }));

import {
  mergeRemoteNotes, noteToRow, resolveConflict, rowToNote,
} from '../sync';
import { emptyNotesState, Note, NotesState } from '../types';

const SYNC = '2026-11-20T00:00:00.000Z';
const NOW = '2026-11-23T02:00:00.000Z';

function note(id: string, updated: string, device: string, body = 'text'): Note {
  return {
    id, user_id: 'u1', title: 'Title', body_md: `Title\n\n${body}`,
    folder_id: null, pinned: false, pinned_at: null, locked: false, cipher_blob: null,
    created_at: '2026-11-01T00:00:00.000Z', updated_at: updated,
    deleted_at: null, version: 2, device_id: device,
  };
}

function stateWith(notes: Note[], lastSyncAt: string | null = SYNC): NotesState {
  return { ...emptyNotesState(), notes, lastSyncAt };
}

describe('row mapping', () => {
  it('round-trips every sync field', () => {
    const n = note('n1', NOW, 'd1', 'Buy milk');
    const row = noteToRow(n, 'u1');
    expect(row.body_md).toBe(n.body_md);
    expect(row.deleted_at).toBeNull();
    expect(row.version).toBe(2);
    expect(rowToNote(row)).toEqual(n);
  });
});

describe('last-write-wins', () => {
  it('keeps the local note when only local changed since sync', () => {
    const local = note('n1', NOW, 'd1', 'local edit');
    const remote = note('n1', SYNC, 'd2', 'old');
    const result = resolveConflict(local, remote, SYNC, NOW, 'd1');
    expect(result.kept).toBe(local);
    expect(result.copy).toBeNull();
  });

  it('takes the remote note when only remote changed since sync', () => {
    const local = note('n1', SYNC, 'd1', 'old');
    const remote = note('n1', NOW, 'd2', 'remote edit');
    expect(resolveConflict(local, remote, SYNC, NOW, 'd1').kept).toBe(remote);
  });
});

describe('conflict copy rule', () => {
  it('keeps newer and saves older as a (conflict) copy with a fresh id', () => {
    const local = note('n1', '2026-11-23T01:00:00.000Z', 'd1', 'local text');
    const remote = note('n1', '2026-11-23T03:00:00.000Z', 'd2', 'remote text');
    const result = resolveConflict(local, remote, SYNC, NOW, 'device-new');
    expect(result.kept.body_md).toContain('remote text');
    expect(result.copy).not.toBeNull();
    expect(result.copy?.id).not.toBe(local.id);
    expect(result.copy?.title).toBe('(conflict) Title');
    expect(result.copy?.body_md).toContain('local text');
    expect(result.copy?.version).toBe(1);
    expect(result.copy?.deleted_at).toBeNull();
    expect(result.copy?.device_id).toBe('device-new');
  });

  it('does not create a copy when both devices are the same', () => {
    const local = note('n1', '2026-11-23T01:00:00.000Z', 'd1', 'a');
    const remote = note('n1', '2026-11-23T03:00:00.000Z', 'd1', 'b');
    expect(resolveConflict(local, remote, SYNC, NOW, 'd1').copy).toBeNull();
  });
});

describe('mergeRemoteNotes', () => {
  it('adds unknown remote notes', () => {
    const remote = note('n2', NOW, 'd2');
    const result = mergeRemoteNotes(stateWith([]), [remote], NOW, 'd1');
    expect(result.state.notes.map((n) => n.id)).toEqual(['n2']);
    expect(result.events).toHaveLength(0);
  });

  it('enqueues a conflict copy so it survives queue compaction', () => {
    const local = note('n1', '2026-11-23T01:00:00.000Z', 'd1', 'local');
    const remote = note('n1', '2026-11-23T03:00:00.000Z', 'd2', 'remote');
    const result = mergeRemoteNotes(stateWith([local]), [remote], NOW, 'd1');
    expect(result.state.notes).toHaveLength(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].entity).toBe('note');
    expect(result.events[0].action).toBe('create');
    expect((result.events[0].data as any).title).toBe('(conflict) Title');
  });

  it('does not recreate a copy on a second pull', () => {
    const local = note('n1', '2026-11-23T01:00:00.000Z', 'd1', 'local');
    const remote = note('n1', '2026-11-23T03:00:00.000Z', 'd2', 'remote');
    const first = mergeRemoteNotes(stateWith([local]), [remote], NOW, 'd1');
    const mergedState = { ...first.state, lastSyncAt: NOW };
    const second = mergeRemoteNotes(mergedState, [remote], NOW, 'd1');
    expect(second.events).toHaveLength(0);
  });
});
