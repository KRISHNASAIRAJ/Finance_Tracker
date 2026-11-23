import {
  canRedo, canUndo, currentText, flushDraft, HISTORY_LIMIT,
  makeHistory, pushHistory, redo, undo,
} from '../editorHistory';

describe('editor history', () => {
  it('undoes and redoes text changes', () => {
    let h = makeHistory('Title\n\nb');
    h = pushHistory(h, 'Title\n\nbody');
    expect(currentText(h)).toBe('Title\n\nbody');
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(currentText(h)).toBe('Title\n\nb');
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(currentText(h)).toBe('Title\n\nbody');
  });

  it('drops the redo stack after a new edit', () => {
    let h = pushHistory(makeHistory('a'), 'b');
    h = undo(h);
    h = pushHistory(h, 'c');
    expect(canRedo(h)).toBe(false);
    expect(currentText(h)).toBe('c');
  });

  it('caps history at HISTORY_LIMIT without losing the latest text', () => {
    let h = makeHistory('');
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = pushHistory(h, `text-${i}`);
    expect(h.entries.length).toBe(HISTORY_LIMIT);
    expect(currentText(h)).toBe(`text-${HISTORY_LIMIT + 19}`);
    expect(canUndo(h)).toBe(true);
  });

  it('handles a 100k-character note without mutating or truncating it', () => {
    const big = `Title\n\n${'word '.repeat(20000)}`;
    let h = makeHistory('');
    const t0 = Date.now();
    h = pushHistory(h, big);
    expect(currentText(h).length).toBe(big.length);
    h = undo(h);
    expect(currentText(h)).toBe('');
    h = redo(h);
    expect(currentText(h)).toBe(big);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('ignores a no-op edit', () => {
    const h = makeHistory('same');
    expect(pushHistory(h, 'same')).toBe(h);
  });
});

describe('flushDraft (local write before sync)', () => {
  it('writes the exact current text for the given note', async () => {
    const updateBody = jest.fn(async () => {});
    const big = `Title\n\n${'x'.repeat(100000)}`;
    await flushDraft('note-1', big, updateBody);
    expect(updateBody).toHaveBeenCalledWith('note-1', big);
    expect((updateBody.mock.calls[0][1] as string).length).toBe(big.length);
  });

  it('does nothing without a note id', async () => {
    const updateBody = jest.fn();
    await flushDraft('', 'text', updateBody);
    expect(updateBody).not.toHaveBeenCalled();
  });
});
