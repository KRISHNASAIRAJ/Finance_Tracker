jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { store.delete(key); }),
      clear: jest.fn(async () => { store.clear(); }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueue } from '../../../services/syncQueue';
import { loadState, NOTES_V2_STORAGE_KEY, persist, saveState } from '../repository';
import { emptyNotesState, Note } from '../types';

const note: Note = {
  id: 'n1', user_id: 'u1', title: 'Title', body_md: 'Title\n\nbody', folder_id: null,
  pinned: false, pinned_at: null, locked: false, cipher_blob: null,
  created_at: '2026-11-01T00:00:00.000Z', updated_at: '2026-11-01T00:00:00.000Z',
  deleted_at: null, version: 1, device_id: 'd1',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('local persistence', () => {
  it('returns an empty state when nothing is stored', async () => {
    expect(await loadState()).toEqual(emptyNotesState());
  });

  it('round-trips state through AsyncStorage', async () => {
    const state = { ...emptyNotesState(), notes: [note] };
    await saveState(state);
    expect((await loadState()).notes).toEqual([note]);
  });

  it('falls back to empty state on corrupt data', async () => {
    await AsyncStorage.setItem(NOTES_V2_STORAGE_KEY, '{not-json');
    expect(await loadState()).toEqual(emptyNotesState());
  });

  it('fills missing fields from an older payload', async () => {
    await AsyncStorage.setItem(NOTES_V2_STORAGE_KEY, JSON.stringify({ notes: [note] }));
    const loaded = await loadState();
    expect(loaded.tags).toEqual([]);
    expect(loaded.migratedLegacyIds).toEqual([]);
  });
});

describe('persist order', () => {
  it('writes local state before enqueuing sync rows', async () => {
    const state = { ...emptyNotesState(), notes: [note] };
    await persist(state, [{ entity: 'note', action: 'create', data: { id: 'n1', user_id: 'u1' } }]);

    const raw = await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY);
    expect(JSON.parse(raw!).notes).toHaveLength(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entity).toBe('note');
    expect(queue[0].action).toBe('create');
  });
});
