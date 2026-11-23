/**
 * repository — local persistence for Notes v2 and the bridge to the existing
 * offline-first sync queue. Local state is ALWAYS written before syncing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { enqueue } from '../../services/syncQueue';
import { emptyNotesState, NotesState } from './types';
import { normalizeState } from './ops';

export const NOTES_V2_STORAGE_KEY = 'meridian-notes-v2-storage';

export interface SyncEvent {
  entity: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
}

export async function loadState(): Promise<NotesState> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_V2_STORAGE_KEY);
    if (!raw) return emptyNotesState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.notes)) return emptyNotesState();
    return normalizeState(parsed as NotesState);
  } catch {
    return emptyNotesState();
  }
}

export async function saveState(state: NotesState): Promise<void> {
  await AsyncStorage.setItem(NOTES_V2_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

/** Write local state first, then hand the queued row ops to syncQueue. */
export async function persist(state: NotesState, events: SyncEvent[] = []): Promise<void> {
  await saveState(state);
  for (const event of events) {
    try {
      await enqueue(event.entity, event.action, event.data);
    } catch (e) {
      // The row is durable locally; syncQueue will retry on next launch.
      console.warn('[NotesRepository] enqueue failed:', event.entity, e);
    }
  }
}
