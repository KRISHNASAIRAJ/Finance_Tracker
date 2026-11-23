/**
 * editorHistory — bounded undo/redo for the note editor.
 *
 * Kept as a pure module so the 100k-character and "process death" behaviours
 * can be tested without rendering a native TextInput.
 */
export interface EditorHistory {
  entries: string[];
  index: number;
}

export const HISTORY_LIMIT = 50;

export function makeHistory(initial: string): EditorHistory {
  return { entries: [initial], index: 0 };
}

/** Record a new text state. Typing every keystroke is capped at HISTORY_LIMIT. */
export function pushHistory(history: EditorHistory, text: string): EditorHistory {
  if (history.entries[history.index] === text) return history;
  const entries = [...history.entries.slice(0, history.index + 1), text];
  const overflow = Math.max(0, entries.length - HISTORY_LIMIT);
  return {
    entries: overflow ? entries.slice(overflow) : entries,
    index: entries.length - 1 - overflow,
  };
}

export function canUndo(history: EditorHistory): boolean {
  return history.index > 0;
}

export function canRedo(history: EditorHistory): boolean {
  return history.index < history.entries.length - 1;
}

export function undo(history: EditorHistory): EditorHistory {
  return canUndo(history) ? { ...history, index: history.index - 1 } : history;
}

export function redo(history: EditorHistory): EditorHistory {
  return canRedo(history) ? { ...history, index: history.index + 1 } : history;
}

export function currentText(history: EditorHistory): string {
  return history.entries[history.index] ?? '';
}

/**
 * The exact text that must be written to local storage on flush. Local write
 * happens BEFORE any sync enqueue (see repository.persist).
 */
export function flushDraft(
  noteId: string,
  draft: string,
  updateBody: (id: string, body: string) => Promise<void> | void
): Promise<void> {
  if (!noteId) return Promise.resolve();
  return Promise.resolve(updateBody(noteId, draft));
}
