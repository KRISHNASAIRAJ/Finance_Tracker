/**
 * Notes list (screen 1) — large title, search with highlighting, folder chips,
 * Pinned / Today / Yesterday / Previous 7 days / month groups, swipe to pin or
 * delete with Undo, long-press quick menu, gallery toggle and compose FAB.
 *
 * Uses only the shared Meridian kit and tokens. The large title collapses into
 * the top bar over 200 ms of scroll (the spec's motion rule).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { alpha, mc, mr, mm } from '../../../shared/theme/meridian';
import {
  Chip, EmptyState, Fab, Label, PressScale, Rise, Screen, TopBar, useReducedMotion,
} from '../../../shared/components/meridian';
import { useNotesStore } from '../store';
import { useNotesBootstrap } from '../hooks/useNotesBootstrap';
import type { Note } from '../types';
import NoteRow from '../components/NoteRow';
import SwipeableNoteRow from '../components/SwipeableNoteRow';
import UndoToast from '../components/UndoToast';
import NoteQuickMenu from '../components/NoteQuickMenu';

/** Search debounce and the spec's title-collapse duration (mm.crossfade = 250). */
const SEARCH_DEBOUNCE_MS = 200;

function groupKey(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const at = date.getTime();
  if (at >= today) return 'TODAY';
  if (at >= today - 86400000) return 'YESTERDAY';
  if (at >= today - 7 * 86400000) return 'PREVIOUS 7 DAYS';
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function NotesListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialFolder = (route.params as any)?.folder;
  const { error } = useNotesBootstrap();

  const notes = useNotesStore((s) => s.notes);
  const folders = useNotesStore((s) => s.folders);
  const noteLinks = useNotesStore((s) => s.noteLinks);
  const searchFn = useNotesStore((s) => s.search);
  const rememberSearch = useNotesStore((s) => s.rememberSearch);
  const trash = useNotesStore((s) => s.trash);
  const restore = useNotesStore((s) => s.restore);
  const togglePin = useNotesStore((s) => s.togglePin);
  const move = useNotesStore((s) => s.move);
  const create = useNotesStore((s) => s.create);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [activeFolder, setActiveFolder] = useState(initialFolder ?? 'all');

  useEffect(() => {
    if (initialFolder) setActiveFolder(initialFolder);
  }, [initialFolder]);
  const [menuNote, setMenuNote] = useState<Note | null>(null);
  const [undoNote, setUndoNote] = useState<Note | null>(null);

  const reduced = useReducedMotion();
  const scrollY = useRef(new Animated.Value(0)).current;
  const largeOpacity = scrollY.interpolate({
    inputRange: [0, 70], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [40, 90], outputRange: [0, 1], extrapolate: 'clamp',
  });

  useEffect(() => {
    if (debouncedQuery.trim()) rememberSearch(debouncedQuery);
  }, [debouncedQuery, rememberSearch]);

  const searchIds = useMemo(() => {
    if (!debouncedQuery.trim()) return null;
    return new Set(searchFn(debouncedQuery).map((n) => n.id));
  }, [debouncedQuery, searchFn]);

  const visible = useMemo(() => {
    const linkedIds = new Set(noteLinks.map((l) => l.note_id));
    const list = notes.filter((n) => {
      if (activeFolder === 'trash') {
        if (!n.deleted_at) return false;
      } else if (n.deleted_at) {
        return false;
      }
      if (activeFolder === 'pinned' && !n.pinned) return false;
      if (activeFolder === 'locked' && !n.locked) return false;
      if (activeFolder === 'linked' && !linkedIds.has(n.id)) return false;
      if (activeFolder === 'checklists' && !/^\s*[-*+]\s+\[[ xX]\]/.test(n.body_md)) return false;
      if (folders.some((f) => f.id === activeFolder) && n.folder_id !== activeFolder) return false;
      if (searchIds && !searchIds.has(n.id)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [notes, noteLinks, folders, activeFolder, searchIds]);

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of visible) {
      const key = note.pinned && activeFolder !== 'pinned' ? 'PINNED' : groupKey(note.updated_at);
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visible, activeFolder]);

  const folderName = (note: Note) => folders.find((f) => f.id === note.folder_id)?.name ?? null;
  const hasLink = (note: Note) => noteLinks.some((l) => l.note_id === note.id);

  const handleDelete = (note: Note) => {
    trash(note.id);
    setUndoNote(note);
  };

  const handleCreate = async () => {
    const note = await create('');
    (navigation as any).navigate('NotesV2Editor', { noteId: note.id });
  };

  const openNote = (note: Note) => {
    (navigation as any).navigate('NotesV2Editor', { noteId: note.id });
  };

  let rowIndex = 0;

  return (
    <View style={styles.root}>
    <Screen
      scroll
      bottomInset={96}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      floating={
        <>
          {undoNote ? (
            <View style={styles.toastSlot}>
              <UndoToast
                message="Note moved to Recently deleted"
                onUndo={() => { restore(undoNote.id); setUndoNote(null); }}
                onDone={() => setUndoNote(null)}
              />
            </View>
          ) : null}
          <View style={styles.fabSlot}>
            <Fab icon="pencil" size={52} onPress={handleCreate} accessibilityLabel="New note" />
          </View>
        </>
      }
    >
      <Animated.View style={[styles.largeTitle, { opacity: reduced ? 1 : largeOpacity }]}>
        <Text style={styles.largeTitleText}>Notes</Text>
        <Text style={styles.noteCount}>
          {notes.filter((n) => !n.deleted_at).length} notes
        </Text>
      </Animated.View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={mc.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes"
          placeholderTextColor={mc.textGhost}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 ? (
          <Ionicons name="close-circle" size={16} color={mc.textDim} onPress={() => setQuery('')} />
        ) : null}
      </View>

      <View style={styles.chips}>
        {[
          { id: 'all', label: 'All' },
          ...folders.map((f) => ({ id: f.id, label: f.name })),
          { id: 'pinned', label: 'Pinned' },
          { id: 'checklists', label: 'Checklists' },
          { id: 'linked', label: 'Linked' },
          { id: 'locked', label: 'Locked' },
        ].map((chip) => (
          <PressScale key={chip.id} onPress={() => setActiveFolder(chip.id)} scale={0.95} style={styles.chipWrap}>
            <Chip
              color={activeFolder === chip.id ? mc.amber : mc.textDim}
              variant={activeFolder === chip.id ? 'solid' : 'plain'}
              size="sm"
              icon={chip.id === 'locked' ? 'lock-closed-outline' : undefined}
            >
              {chip.label}
            </Chip>
          </PressScale>
        ))}
      </View>

      {error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load notes"
          subtitle={error}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={query ? 'No matching notes' : 'No notes yet'}
          subtitle={query ? 'Try a different search.' : 'Tap the pencil to write your first note.'}
        />
      ) : (
        groups.map(([label, items]) => (
          <View key={label} style={styles.group}>
            <Label style={styles.groupLabel}>
              {label === 'PINNED' ? '\u{1F4CC} PINNED' : label}
            </Label>
            {items.map((note, i) => {
              const index = rowIndex++;
              return (
                <Rise key={note.id} index={Math.min(index, 8)} step={mm.stagger} distance={10}>
                  <SwipeableNoteRow
                    pinned={note.pinned}
                    onPin={() => togglePin(note.id)}
                    onDelete={() => handleDelete(note)}
                  >
                    <NoteRow
                      note={note}
                      folderName={folderName(note)}
                      query={debouncedQuery}
                      hasLink={hasLink(note)}
                      onPress={() => openNote(note)}
                      onLongPress={() => setMenuNote(note)}
                    />
                  </SwipeableNoteRow>
                  {i < items.length - 1 ? <View style={styles.divider} /> : null}
                </Rise>
              );
            })}
          </View>
        ))
      )}

      <NoteQuickMenu
        note={menuNote}
        folders={folders}
        onClose={() => setMenuNote(null)}
        onPin={(n) => togglePin(n.id)}
        onMove={(n, folderId) => move(n.id, folderId)}
        onDelete={handleDelete}
      />
    </Screen>
    <Animated.View
      style={[styles.compactBar, { opacity: reduced ? 0 : compactOpacity }]}
      pointerEvents="box-none"
    >
      <TopBar
        title="Notes"
        variant="center"
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.headerActions}>
            <PressScale
              onPress={() => (navigation as any).navigate('NotesV2Gallery')}
              scale={0.9}
              accessibilityLabel="Gallery view"
              style={styles.headerBtn}
            >
              <Ionicons name="grid-outline" size={18} color={mc.amber} />
            </PressScale>
            <PressScale
              onPress={() => (navigation as any).navigate('NotesV2Folders')}
              scale={0.9}
              accessibilityLabel="Folders and tags"
              style={styles.headerBtn}
            >
              <Ionicons name="folder-outline" size={18} color={mc.text} />
            </PressScale>
          </View>
        }
      />
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mc.canvas },
  compactBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: mc.canvas },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  largeTitle: { marginTop: 2 },
  largeTitleText: { fontSize: 32, fontWeight: '600', color: mc.text, letterSpacing: -0.5 },
  noteCount: { fontSize: 12, color: mc.textDim, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: mc.card, borderRadius: mr.chip, paddingHorizontal: 14, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: mc.text, paddingVertical: 0 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  chipWrap: { borderRadius: mr.chip },
  group: { gap: 6, marginTop: 6 },
  groupLabel: { marginTop: 8, marginBottom: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: alpha(mc.line, 0.6), marginHorizontal: 6 },
  toastSlot: { position: 'absolute', left: 18, right: 18, bottom: 84 },
  fabSlot: { position: 'absolute', right: 18, bottom: 18 },
});
