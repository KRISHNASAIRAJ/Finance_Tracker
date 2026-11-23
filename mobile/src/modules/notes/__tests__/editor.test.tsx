/** Editor behaviour: title/preview rules, autosave, process death, undo/redo. */
let mockState: any;

jest.mock('../hooks/useNotesBootstrap', () => ({
  useNotesBootstrap: () => ({ hydrated: true, error: null }),
}));

jest.mock('../store', () => ({
  useNotesStore: (selector?: (s: any) => any) => (selector ? selector(mockState) : mockState),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { noteId: 'note-1' } }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../../shared/components/meridian/useReducedMotion', () => ({
  __esModule: true, default: () => true,
}));

import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import NotesEditorScreen from '../screens/NotesEditorScreen';
import { AUTOSAVE_MS } from '../types';

const original = 'Grocery list\n\nBuy milk and soap';

beforeEach(() => {
  mockState = {
    notes: [{
      id: 'note-1', user_id: 'u1', title: 'Grocery list', body_md: original,
      folder_id: null, pinned: false, pinned_at: null, locked: false, cipher_blob: null,
      created_at: '2026-11-16T02:02:00.000Z', updated_at: '2026-11-16T02:02:00.000Z',
      deleted_at: null, version: 1, device_id: 'd1',
    }],
    folders: [], tags: [{ id: 't1', user_id: 'u1', name: 'weekly' }],
    noteTags: [{ note_id: 'note-1', tag_id: 't1' }],
    noteLinks: [],
    updateBody: jest.fn(async () => {}),
    togglePin: jest.fn(), move: jest.fn(), addTag: jest.fn(async () => {}),
    create: jest.fn(async () => ({ id: 'copy' })), trash: jest.fn(), purge: jest.fn(),
  };
});

function mount() {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<NotesEditorScreen />); });
  return tree!;
}

function textsOf(tree: renderer.ReactTestRenderer) {
  const out: string[] = [];
  const walk = (value: any) => {
    if (typeof value === 'string') { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value?.props) walk(value.props.children);
  };
  tree.root.findAllByType('Text').forEach((n) => walk(n.props.children));
  return out.join(' ');
}

describe('editor rendering', () => {
  it('derives the title from line 1 and shows the date line and tag chip', () => {
    const tree = mount();
    const all = textsOf(tree);
    expect(all).toContain('Grocery list');
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe(original);
    expect(all.replace(/\s+/g, '')).toContain('#weekly');
    expect(all).toMatch(/2026/);
    act(() => tree.unmount());
  });
});

describe('autosave and process death', () => {
  it('flushes the exact draft to local storage when the screen unmounts', async () => {
    const tree = mount();
    const input = tree.root.findAllByType(TextInput)[0];
    const big = `Grocery list\n\n${'a'.repeat(100000)}`;
    act(() => input.props.onChangeText(big));
    await act(async () => { tree.unmount(); });
    expect(mockState.updateBody).toHaveBeenCalledWith('note-1', big);
  });

  it('does not write when nothing changed', async () => {
    const tree = mount();
    await act(async () => { tree.unmount(); });
    expect(mockState.updateBody).not.toHaveBeenCalled();
  });

  it('uses a 500 ms debounce after the last keystroke', async () => {
    jest.useFakeTimers();
    try {
      const tree = mount();
      const input = tree.root.findAllByType(TextInput)[0];
      act(() => input.props.onChangeText('Grocery list\n\nnew text'));
      await act(async () => { jest.advanceTimersByTime(AUTOSAVE_MS - 1); });
      expect(mockState.updateBody).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(1); });
      expect(mockState.updateBody).toHaveBeenCalledWith('note-1', 'Grocery list\n\nnew text');
      act(() => tree.unmount());
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('undo / redo toolbar', () => {
  it('restores the previous text on Undo', () => {
    const tree = mount();
    const input = tree.root.findAllByType(TextInput)[0];
    act(() => input.props.onChangeText('Grocery list\n\nchanged'));
    const undoBtn = tree.root.findAll(
      (n) => n.props?.accessibilityLabel === 'Undo' && typeof n.props?.onPress === 'function'
    )[0];
    expect(undoBtn).toBeDefined();
    act(() => undoBtn.props.onPress());
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe(original);
    act(() => tree.unmount());
  });
});
