/**
 * search — in-memory full-text index over unlocked notes.
 *
 * Locked notes are intentionally excluded from the index and from search
 * results: their plain text must never leak into search, previews or logs.
 */
import type { Note, NotesState } from './types';

export type SearchIndex = Map<string, Set<string>>;

/** ASCII + Latin-1 letters/digits; enough for Meridian's note content. */
export function tokenize(text: string): string[] {
  const found = String(text || '').toLowerCase().match(/[a-z0-9\u00c0-\u00ff]+/g);
  return found ?? [];
}

function addTokens(index: SearchIndex, tokens: string[], noteId: string): void {
  for (const token of tokens) {
    let set = index.get(token);
    if (!set) {
      set = new Set<string>();
      index.set(token, set);
    }
    set.add(noteId);
  }
}

/** Build the inverted index from note title, body, tag names and folder name. */
export function buildIndex(state: NotesState): SearchIndex {
  const index: SearchIndex = new Map();
  const tagNames = new Map(state.tags.map((t) => [t.id, t.name]));
  const folderNames = new Map(state.folders.map((f) => [f.id, f.name]));
  const tagsByNote = new Map<string, string[]>();
  for (const nt of state.noteTags) {
    const name = tagNames.get(nt.tag_id);
    if (!name) continue;
    const list = tagsByNote.get(nt.note_id) ?? [];
    list.push(name);
    tagsByNote.set(nt.note_id, list);
  }

  for (const note of state.notes) {
    if (note.deleted_at || note.locked) continue;
    addTokens(index, tokenize(note.title), note.id);
    addTokens(index, tokenize(note.body_md), note.id);
    addTokens(index, tokenize((tagsByNote.get(note.id) ?? []).join(' ')), note.id);
    const folder = note.folder_id ? folderNames.get(note.folder_id) : null;
    if (folder) addTokens(index, tokenize(folder), note.id);
  }
  return index;
}

/** Ranked search (AND across tokens); title/tag/folder matches score higher. */
export function searchNotes(query: string, state: NotesState, index: SearchIndex): Note[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  let candidateIds: Set<string> | null = null;
  for (const token of tokens) {
    const ids = index.get(token);
    if (!ids || ids.size === 0) return [];
    if (candidateIds === null) {
      candidateIds = new Set<string>(ids);
    } else {
      const intersection = new Set<string>();
      for (const id of candidateIds) {
        if (ids.has(id)) intersection.add(id);
      }
      candidateIds = intersection;
    }
    if (candidateIds.size === 0) return [];
  }
  const candidates = candidateIds as Set<string>;

  const tagNames = new Map(state.tags.map((t) => [t.id, t.name.toLowerCase()]));
  const folderNames = new Map(state.folders.map((f) => [f.id, f.name.toLowerCase()]));
  const tagsByNote = new Map<string, string[]>();
  for (const nt of state.noteTags) {
    const name = tagNames.get(nt.tag_id);
    if (!name) continue;
    const list = tagsByNote.get(nt.note_id) ?? [];
    list.push(name);
    tagsByNote.set(nt.note_id, list);
  }

  const scored: Array<{ note: Note; score: number }> = [];
  for (const note of state.notes) {
    if (!candidates.has(note.id) || note.deleted_at || note.locked) continue;
    const title = note.title.toLowerCase();
    const body = note.body_md.toLowerCase();
    const tags = (tagsByNote.get(note.id) ?? []).join(' ');
    const folder = note.folder_id ? (folderNames.get(note.folder_id) ?? '') : '';
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 3;
      if (tags.includes(token)) score += 2;
      if (folder.includes(token)) score += 2;
      if (body.includes(token)) score += 1;
    }
    scored.push({ note, score });
  }
  scored.sort((a, b) => b.score - a.score || b.note.updated_at.localeCompare(a.note.updated_at));
  return scored.map((s) => s.note);
}

export interface HighlightSegment { text: string; match: boolean }

/** Split text into matched / unmatched segments for highlighting in list rows. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [{ text, match: false }];
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = `(${escaped.join('|')})`;
  const splitRe = new RegExp(pattern, 'gi');
  // A separate non-global regex avoids the stateful lastIndex trap.
  const matchRe = new RegExp(`^${pattern}$`, 'i');
  const parts = String(text || '').split(splitRe);
  return parts.filter((p) => p.length > 0).map((p) => ({ text: p, match: matchRe.test(p) }));
}

/** Most-recent-first, case-insensitive dedupe, capped at 8. */
export function addRecentSearch(list: string[], query: string): string[] {
  const q = query.trim();
  if (!q) return list;
  const lower = q.toLowerCase();
  return [q, ...list.filter((s) => s.toLowerCase() !== lower)].slice(0, 8);
}
