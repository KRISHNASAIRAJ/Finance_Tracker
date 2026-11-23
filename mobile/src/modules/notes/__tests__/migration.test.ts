let mockLegacyNotes: any[] = [];

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

jest.mock('../../../services/supabaseClient', () => ({ supabase: {} }));

jest.mock('../../personal/store', () => ({
  usePersonalStore: {
    getState: () => ({ notes: mockLegacyNotes }),
    setState: jest.fn((patch: any) => {
      if (patch && Array.isArray(patch.notes)) mockLegacyNotes = patch.notes;
    }),
  },
}));

jest.mock('../../../services/backupService', () => ({ exportAllData: jest.fn(async () => {}) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMigrationBackup, isMigrationDone, mapLegacyNote, mapV2ToLegacy,
  NOTES_V2_BACKUP_KEY, NOTES_V2_MIGRATED_KEY, planMigration,
  rollbackMigration, runMigration,
} from '../migration';
import { NOTES_V2_STORAGE_KEY } from '../repository';
import { emptyNotesState, Note } from '../types';

const NOW = '2026-11-23T02:00:00.000Z';

const legacy = (id: string, folder = 'Notes', extra: any = {}) => ({
  id, title: `${id} title`, content: `${id} content`, date: '2026-11-01T10:00:00.000Z',
  folder, pinned: false, deletedAt: null, ...extra,
});

beforeEach(async () => {
  mockLegacyNotes = [];
  await AsyncStorage.clear();
});

describe('backup first', () => {
  it('writes and verifies a notes snapshot before migration', async () => {
    mockLegacyNotes = [legacy('old-1')];
    const backup = await createMigrationBackup();
    expect(backup.legacyNotes).toHaveLength(1);
    const raw = await AsyncStorage.getItem(NOTES_V2_BACKUP_KEY);
    expect(JSON.parse(raw!).legacyNotes[0].id).toBe('old-1');
  });
});

describe('field mapping', () => {
  it('puts the old title on line 1 and the old content after it', () => {
    const mapped = mapLegacyNote(legacy('old-1', 'Work', { pinned: true }), 'u1', 'd1', NOW);
    expect(mapped.note.body_md).toBe('old-1 title\n\nold-1 content');
    expect(mapped.note.title).toBe('old-1 title');
    expect(mapped.note.pinned).toBe(true);
    expect(mapped.note.pinned_at).toBe('2026-11-01T10:00:00.000Z');
    expect(mapped.folderName).toBe('Work');
    expect(mapped.folder?.name).toBe('Work');
    expect(mapped.note.folder_id).toBe(mapped.folder?.id);
  });

  it('keeps soft-deleted notes in Recently deleted', () => {
    const mapped = mapLegacyNote(legacy('old-2', 'Notes', { deletedAt: NOW }), 'u1', 'd1', NOW);
    expect(mapped.note.deleted_at).toBe(NOW);
    expect(mapped.folderName).toBeNull();
  });

  it('reverse-maps a v2 note back to the legacy shape', () => {
    const v2: Note = { ...mapLegacyNote(legacy('old-3'), 'u1', 'd1', NOW).note };
    const back = mapV2ToLegacy(v2);
    expect(back.title).toBe('old-3 title');
    expect(back.content).toBe('old-3 content');
    expect(back.pinned).toBe(false);
  });
});

describe('planMigration', () => {
  it('is idempotent for the same legacy ids', () => {
    const all = [legacy('old-1', 'Work'), legacy('old-2', 'Work'), legacy('old-3')];
    const first = planMigration(all, emptyNotesState(), 'u1', 'd1', NOW);
    const second = planMigration(all, first.state, 'u1', 'd1', NOW);
    expect(first.state.notes).toHaveLength(3);
    expect(second.state.notes).toHaveLength(3);
    expect(second.events).toHaveLength(0);
    expect(second.state.migratedLegacyIds.sort()).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('creates one folder per distinct folder name', () => {
    const plan = planMigration([legacy('a', 'Work'), legacy('b', 'work')], emptyNotesState(), 'u1', 'd1', NOW);
    expect(plan.state.folders).toHaveLength(1);
    expect(plan.state.notes.every((n) => n.folder_id === plan.state.folders[0].id)).toBe(true);
  });
});

describe('orchestration and rollback', () => {
  it('runs once, writes the marker, and skips a second run', async () => {
    mockLegacyNotes = [legacy('old-1')];
    await runMigration('u1', 'd1');
    expect(await isMigrationDone()).toBe(true);
    const stored = JSON.parse((await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY))!);
    expect(stored.notes).toHaveLength(1);

    mockLegacyNotes = [legacy('old-1'), legacy('old-2')];
    await runMigration('u1', 'd1');
    const storedAgain = JSON.parse((await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY))!);
    expect(storedAgain.notes).toHaveLength(1);
  });

  it('restores the snapshot and reverse-maps v2-only notes on rollback', async () => {
    mockLegacyNotes = [legacy('old-1')];
    await runMigration('u1', 'd1');

    const stored = JSON.parse((await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY))!);
    const v2Only: Note = {
      ...stored.notes[0], id: 'v2-only', title: 'New v2 note', body_md: 'New v2 note\n\nKept text',
    };
    stored.notes.push(v2Only);
    await AsyncStorage.setItem(NOTES_V2_STORAGE_KEY, JSON.stringify(stored));

    await rollbackMigration();
    expect(mockLegacyNotes.map((n) => n.id)).toEqual(['old-1', 'v2-only']);
    expect(mockLegacyNotes.find((n) => n.id === 'v2-only')?.content).toBe('Kept text');
    expect(await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY)).toBeNull();
    expect(await isMigrationDone()).toBe(false);
  });

  it('refuses to roll back without a backup', async () => {
    await expect(rollbackMigration()).rejects.toThrow('no backup');
  });
});
