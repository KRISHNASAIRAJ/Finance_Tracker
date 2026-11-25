/**
 * Screen contract tests for screens 1–3 against meridian_notes_screens.html.
 * No browser/screenshot harness is installed, so this asserts the exact
 * screen labels, groups, badges and palette tokens from the mockup through
 * react-test-renderer rather than pixels.
 */
let mockState: any;

jest.mock('../hooks/useNotesBootstrap', () => ({
  useNotesBootstrap: () => ({ hydrated: true, error: null }),
}));

jest.mock('../store', () => ({
  useNotesStore: (selector?: (s: any) => any) => (selector ? selector(mockState) : mockState),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

// Icon font loading is async and floods the test with act() warnings; the
// contract here is about text/labels, not glyphs.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// Rise/PressScale use React Native Animated timers; with reduced motion they
// jump to the final frame, so no animation outlives the test environment.
jest.mock('../../../shared/components/meridian/useReducedMotion', () => ({
  __esModule: true,
  default: () => true,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { mc } from '../../../shared/theme/meridian';
import NotesListScreen from '../screens/NotesListScreen';
import NotesGalleryScreen from '../screens/NotesGalleryScreen';
import NotesFoldersScreen from '../screens/NotesFoldersScreen';

const note = (id: string, extra: any = {}) => {
  // Relative to today so the TODAY/YESTERDAY grouping never rots at midnight.
  const now = new Date();
  const updatedAt = new Date(now.getTime() - 60_000).toISOString();
  return {
    id, user_id: 'u1', title: id === 'n1' ? 'Money rules' : 'Grocery list',
    body_md: `${id === 'n1' ? 'Money rules' : 'Grocery list'}\n\n- [x] Jaggery\n- [ ] Soaps`,
    folder_id: 'f1', pinned: id === 'n1', pinned_at: updatedAt,
    locked: false, cipher_blob: null,
    created_at: updatedAt, updated_at: updatedAt,
    deleted_at: null, version: 1, device_id: 'd1', ...extra,
  };
};

beforeEach(() => {
  mockState = {
    notes: [note('n1'), note('n2')],
    folders: [{
      id: 'f1', user_id: 'u1', name: 'Personal', color: null, sort: 0,
      created_at: '', updated_at: '', deleted_at: null,
    }],
    tags: [{ id: 't1', user_id: 'u1', name: 'money' }],
    noteTags: [{ note_id: 'n1', tag_id: 't1' }],
    noteLinks: [{ note_id: 'n2', entity_type: 'task', entity_id: 'x', missing: false }],
    recentSearches: [],
    lastSyncAt: null,
    hydrated: true,
    search: () => [],
    rememberSearch: jest.fn(),
    trash: jest.fn(),
    restore: jest.fn(),
    togglePin: jest.fn(),
    move: jest.fn(),
    create: jest.fn(async () => note('n3')),
    addFolder: jest.fn(async () => 'f2'),
    purgeExpired: jest.fn(),
  };
});

function collect(value: any, out: string[]) {
  if (value === null || value === undefined || typeof value === 'boolean') return;
  if (typeof value === 'string' || typeof value === 'number') { out.push(String(value)); return; }
  if (Array.isArray(value)) { value.forEach((v) => collect(v, out)); return; }
  if (value?.props) {
    if (typeof value.props.placeholder === 'string') out.push(value.props.placeholder);
    collect(value.props.children, out);
  }
}

function renderScreen(Component: React.ComponentType) {
  let tree: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Component />); });
  const texts: string[] = [];
  tree!.root.findAllByType('Text').forEach((node) => collect(node.props.children, texts));
  tree!.root.findAllByType('TextInput').forEach((node) => {
    if (typeof node.props.placeholder === 'string') texts.push(node.props.placeholder);
  });
  act(() => tree!.unmount());
  return texts;
}

describe('design tokens from the mockup', () => {
  it('uses the amber Notes accent and red primary from the reference', () => {
    expect(mc.amber).toBe('#FFB547');
    expect(mc.red).toBe('#EB0028');
    expect(mc.card).toBe('#131316');
  });
});

describe('screen 1 — notes list', () => {
  it('renders the large title, search, folder chips and date groups', () => {
    const all = renderScreen(NotesListScreen).join(' ');
    ['Notes', 'Search notes', 'All', 'Pinned', 'Checklists', 'Linked', 'Locked',
      'PINNED', 'TODAY', 'Money rules', 'Grocery list', 'Personal'].forEach((label) => {
      expect(all).toContain(label);
    });
  });
});

describe('screen 2 — gallery', () => {
  it('renders the gallery header, checklist progress and locked-card copy', () => {
    mockState.notes.push(note('n4', { title: 'Private', locked: true }));
    const all = renderScreen(NotesGalleryScreen).join(' ');
    const compact = all.replace(/\s+/g, '');
    expect(all).toContain('Gallery');
    expect(all).toContain('Money rules');
    expect(compact).toContain('1of2done');
    expect(all).toContain('Locked note content is hidden');
  });
});

describe('screen 3 — folders and tags', () => {
  it('renders smart folders, user folders, tags and Recently deleted', () => {
    const all = renderScreen(NotesFoldersScreen).join(' ');
    const compact = all.replace(/\s+/g, '');
    ['Folders & tags', 'SMART FOLDERS', 'All notes', 'Pinned', 'Checklists',
      'Locked', 'Linked to Meridian', 'FOLDERS', 'Personal', 'TAGS',
      'Recently deleted', 'New folder'].forEach((label) => {
      expect(all).toContain(label);
    });
    expect(compact).toContain('#money');
  });
});
