import { addRecentSearch, buildIndex, highlightSegments, searchNotes, tokenize } from '../search';
import { emptyNotesState, Note, NotesState } from '../types';

function note(id: string, title: string, body: string, extra: Partial<Note> = {}): Note {
  return {
    id, user_id: 'u1', title, body_md: `${title}\n\n${body}`,
    folder_id: null, pinned: false, pinned_at: null, locked: false, cipher_blob: null,
    created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
    deleted_at: null, version: 1, device_id: 'd1', ...extra,
  };
}

function stateWith(notes: Note[], extra: Partial<NotesState> = {}): NotesState {
  return { ...emptyNotesState(), notes, ...extra };
}

describe('tokenize', () => {
  it('lowercases and splits on punctuation', () => {
    expect(tokenize('Grocery list—milk, 2% milk!')).toEqual(['grocery', 'list', 'milk', '2', 'milk']);
  });
});

describe('full text search', () => {
  const notes = [
    note('n1', 'Grocery list', 'Buy jaggery and soaps'),
    note('n2', 'Trip plan', 'Train timings and packing list'),
    note('n3', 'Locked secret', 'grocery password here', { locked: true, cipher_blob: 'cipher' }),
    note('n4', 'Old grocery', 'trashed note', { deleted_at: '2026-11-20T00:00:00.000Z' }),
    note('n5', 'Meridian ideas', 'cash flow sliders'),
  ];

  it('finds words in title and body', () => {
    const state = stateWith(notes);
    const ids = searchNotes('jaggery', state, buildIndex(state)).map((n) => n.id);
    expect(ids).toEqual(['n1']);
  });

  it('requires all query tokens (AND)', () => {
    const state = stateWith(notes);
    const ids = searchNotes('grocery jaggery', state, buildIndex(state)).map((n) => n.id);
    expect(ids).toEqual(['n1']);
  });

  it('never returns locked or deleted notes', () => {
    const state = stateWith(notes);
    const index = buildIndex(state);
    expect(index.has('password')).toBe(false);
    expect(searchNotes('grocery', state, index).map((n) => n.id)).not.toContain('n3');
    expect(searchNotes('grocery', state, index).map((n) => n.id)).not.toContain('n4');
  });

  it('searches tags and folder names', () => {
    const state = stateWith(notes, {
      tags: [{ id: 't1', user_id: 'u1', name: 'money' }],
      noteTags: [{ note_id: 'n5', tag_id: 't1' }],
      folders: [{
        id: 'f1', user_id: 'u1', name: 'Garage', color: null, sort: 0,
        created_at: '', updated_at: '', deleted_at: null,
      }],
    });
    const modified = state.notes.map((n) => n.id === 'n2' ? { ...n, folder_id: 'f1' } : n);
    const withFolder = { ...state, notes: modified };
    const index = buildIndex(withFolder);
    expect(searchNotes('money', withFolder, index).map((n) => n.id)).toEqual(['n5']);
    expect(searchNotes('garage', withFolder, index).map((n) => n.id)).toEqual(['n2']);
  });

  it('ranks title matches above body matches', () => {
    const state = stateWith([note('a', 'cash', 'flow notes'), note('b', 'Other', 'cash in body')]);
    expect(searchNotes('cash', state, buildIndex(state)).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('handles 1,000 notes in under 200 ms', () => {
    const many = Array.from({ length: 1000 }, (_, i) =>
      note(`n${i}`, `Note ${i}`, `Body content number ${i} with searchable token`));
    const state = stateWith(many);
    const t0 = Date.now();
    const index = buildIndex(state);
    const results = searchNotes('searchable', state, index);
    expect(Date.now() - t0).toBeLessThan(200);
    expect(results.length).toBe(1000);
  });
});

describe('highlighting and recents', () => {
  it('splits matches from plain text', () => {
    expect(highlightSegments('Grocery list for you', 'grocery list')).toEqual([
      { text: 'Grocery', match: true },
      { text: ' ', match: false },
      { text: 'list', match: true },
      { text: ' for you', match: false },
    ]);
  });

  it('keeps 8 unique recents, most recent first', () => {
    let recents: string[] = [];
    for (let i = 0; i < 10; i++) recents = addRecentSearch(recents, `q${i}`);
    expect(recents).toHaveLength(8);
    expect(recents[0]).toBe('q9');
    expect(addRecentSearch(recents, 'Q8')[0]).toBe('Q8');
    expect(addRecentSearch(recents, 'Q8')).toHaveLength(8);
  });
});
