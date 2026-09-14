/**
 * PersonalNotesScreen — Apple-Notes-style: folders list → notes list →
 * full-screen editor. Pinned notes, live search, Recently Deleted with
 * restore, move-to-folder, rename folder, autosave on back.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { tc } from '../../../shared/theme/tracend';
import { usePersonalStore, Note } from '../store';
import { useAuth } from '../../../services/AuthProvider';

const RECENTLY_DELETED = 'Recently Deleted';
const ALL_NOTES = 'All iCloud';

function noteFolder(n: Note): string | null {
  return n.deletedAt ? RECENTLY_DELETED : n.folder || 'Notes';
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export default function PersonalNotesScreen() {
  const navigation = useNavigation();
  const {
    notes, addNote, updateNote, trashNote, restoreNote, purgeNote,
    toggleNotePinned, moveNote, renameFolder,
  } = usePersonalStore();
  const { user } = useAuth();

  const [openFolder, setOpenFolder] = useState<string | null>(null); // null = folders view
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [search, setSearch] = useState('');

  // Folder modal state: null = closed; renameOf = folder being renamed (null = creating new)
  const [folderModal, setFolderModal] = useState(false);
  const [renameOf, setRenameOf] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');

  const [moveModal, setMoveModal] = useState(false);
  const [movingNote, setMovingNote] = useState<Note | null>(null);

  const customFolders = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (!n.deletedAt && n.folder && n.folder !== 'Notes') set.add(n.folder);
    }
    return [...set].sort();
  }, [notes]);

  const folders = useMemo(() => {
    const alive = notes.filter((n) => !n.deletedAt);
    const counts = new Map<string, number>();
    for (const n of alive) {
      const f = n.folder || 'Notes';
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const deletedCount = notes.filter((n) => n.deletedAt).length;
    const out: Array<{ name: string; count: number }> = [
      { name: ALL_NOTES, count: alive.length },
    ];
    for (const name of customFolders) {
      out.push({ name, count: counts.get(name) ?? 0 });
    }
    out.push({ name: 'Notes', count: counts.get('Notes') ?? 0 });
    out.push({ name: RECENTLY_DELETED, count: deletedCount });
    return out;
  }, [notes, customFolders]);

  const visibleNotes = useMemo(() => {
    let list = notes.filter((n) => {
      if (openFolder === ALL_NOTES) return !n.deletedAt;
      return noteFolder(n) === openFolder;
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [notes, openFolder, search]);

  const openEditor = (note: Note | null) => {
    if (note) {
      setEditing(note);
      setDraftTitle(note.title);
      setDraftBody(note.content);
    } else {
      setEditing(null);
      setDraftTitle('');
      setDraftBody('');
    }
    setEditorOpen(true);
  };

  // Autosave on close (Apple Notes parity — no explicit Save button)
  const closeEditor = () => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    const defaultFolder =
      openFolder && openFolder !== ALL_NOTES && openFolder !== RECENTLY_DELETED ? openFolder : 'Notes';
    if (editing) {
      if (title !== editing.title || body !== editing.content) {
        updateNote(editing.id, title || 'New Note', body, user?.id);
      }
    } else if (title || body) {
      addNote(title || 'New Note', body, user?.id, defaultFolder);
    }
    setEditorOpen(false);
    setEditing(null);
    setDraftTitle('');
    setDraftBody('');
  };

  const folderColor = (name: string): string => {
    if (name === ALL_NOTES) return '#ffd9a0';
    if (name === RECENTLY_DELETED) return '#9BA5FF';
    if (name === 'Notes') return '#5ee6ff';
    return '#59D6C7';
  };

  const isCustomFolder = (name: string) =>
    name !== ALL_NOTES && name !== RECENTLY_DELETED && name !== 'Notes';

  const saveFolderModal = () => {
    const name = folderNameInput.trim();
    if (name) {
      if (renameOf && renameOf !== name) {
        renameFolder(renameOf, name, user?.id);
        if (openFolder === renameOf) setOpenFolder(name);
      } else if (!renameOf && !folders.some((f) => f.name === name)) {
        // Creating a new folder = just open it (folders exist when they hold notes;
        // an empty new folder is remembered by navigating in and creating the first note)
        setOpenFolder(name);
      }
    }
    setFolderModal(false);
    setRenameOf(null);
    setFolderNameInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        {openFolder === null ? (
          <>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.logoText}>Notes</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => { setRenameOf(null); setFolderNameInput(''); setFolderModal(true); }}
            >
              <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => { setOpenFolder(null); setSearch(''); }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.logoText} numberOfLines={1}>{openFolder}</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openEditor(null)}
              disabled={openFolder === RECENTLY_DELETED}
            >
              <Ionicons
                name={openFolder === RECENTLY_DELETED ? 'trash-outline' : 'create-outline'}
                size={22}
                color={openFolder === RECENTLY_DELETED ? colors.error : colors.primary}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {openFolder === null ? (
        /* ---- Folders view (Apple Notes opening screen) ---- */
        <ScrollView contentContainerStyle={styles.foldersWrap} showsVerticalScrollIndicator={false}>
          {folders.map((f) => (
            <TouchableOpacity
              key={f.name}
              style={styles.folderRow}
              onPress={() => setOpenFolder(f.name)}
              activeOpacity={0.65}
              onLongPress={isCustomFolder(f.name) ? () => { setRenameOf(f.name); setFolderNameInput(f.name); setFolderModal(true); } : undefined}
            >
              <View style={styles.folderIconWrap}>
                <Ionicons name="folder-outline" size={22} color={folderColor(f.name)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.folderName}>{f.name}</Text>
              </View>
              <Text style={styles.folderCount}>{f.count}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          ))}
          <Text style={styles.foldersHint}>
            Long-press a custom folder to rename. Deleted notes wait in Recently Deleted.
          </Text>
        </ScrollView>
      ) : (
        /* ---- Notes list ---- */
        <View style={{ flex: 1 }}>
          {openFolder !== RECENTLY_DELETED && (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={15} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.notesWrap} showsVerticalScrollIndicator={false}>
            {visibleNotes.length === 0 && (
              <Text style={styles.emptyText}>
                {openFolder === RECENTLY_DELETED
                  ? 'Nothing deleted recently.'
                  : search ? 'No matches.' : 'No notes yet — tap ✎ to start one.'}
              </Text>
            )}
            {visibleNotes.map((n) => {
              const preview = n.content.replace(/\n+/g, ' ').trim();
              return (
                <TouchableOpacity
                  key={n.id}
                  style={styles.noteCard}
                  onPress={() => openEditor(n)}
                  activeOpacity={0.75}
                >
                  <View style={styles.noteRowTop}>
                    {n.pinned && <Ionicons name="pin" size={13} color="#ffd9a0" style={{ marginRight: 5 }} />}
                    <Text style={styles.noteTitle} numberOfLines={1}>{n.title || 'New Note'}</Text>
                    <Text style={styles.noteDate}>{timeLabel(n.date)}</Text>
                  </View>
                  {preview ? (
                    <Text style={styles.notePreview} numberOfLines={2}>{preview}</Text>
                  ) : (
                    <Text style={styles.notePreviewEmpty}>No additional text</Text>
                  )}
                  <View style={styles.noteActions}>
                    {n.deletedAt ? (
                      <>
                        <TouchableOpacity style={styles.actionChip} onPress={() => restoreNote(n.id, user?.id)}>
                          <Ionicons name="arrow-undo-outline" size={13} color="#59D6C7" />
                          <Text style={[styles.actionText, { color: '#59D6C7' }]}>Recover</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionChip} onPress={() => purgeNote(n.id, user?.id)}>
                          <Ionicons name="trash-outline" size={13} color={colors.error} />
                          <Text style={[styles.actionText, { color: colors.error }]}>Delete forever</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity style={styles.actionChip} onPress={() => toggleNotePinned(n.id, user?.id)}>
                          <Ionicons name={n.pinned ? 'pin' : 'pin-outline'} size={13} color={n.pinned ? '#ffd9a0' : 'rgba(255,255,255,0.5)'} />
                          <Text style={styles.actionText}>{n.pinned ? 'Unpin' : 'Pin'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionChip}
                          onPress={() => { setMovingNote(n); setMoveModal(true); }}
                        >
                          <Ionicons name="folder-open-outline" size={13} color="rgba(255,255,255,0.5)" />
                          <Text style={styles.actionText}>Move</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionChip} onPress={() => trashNote(n.id, user?.id)}>
                          <Ionicons name="trash-outline" size={13} color={colors.error} />
                          <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ---- Move-note modal ---- */}
      <Modal visible={moveModal} transparent animationType="fade" onRequestClose={() => setMoveModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMoveModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Move note to</Text>
            {['Notes', ...customFolders].map((fname) => (
              <TouchableOpacity
                key={fname}
                style={styles.modalRow}
                onPress={() => {
                  if (movingNote) moveNote(movingNote.id, fname, user?.id);
                  setMoveModal(false);
                  setMovingNote(null);
                }}
              >
                <Ionicons name="folder-outline" size={18} color="#59D6C7" />
                <Text style={styles.modalRowText}>{fname}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setMoveModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- New/rename folder modal ---- */}
      <Modal visible={folderModal} transparent animationType="fade" onRequestClose={() => setFolderModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => { setFolderModal(false); setRenameOf(null); setFolderNameInput(''); }}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{renameOf ? 'Rename folder' : 'New folder'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={folderNameInput}
              onChangeText={setFolderNameInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={saveFolderModal}>
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setFolderModal(false); setRenameOf(null); setFolderNameInput(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- Full-screen editor (autosave on close) ---- */}
      <Modal visible={editorOpen} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.editorContainer}>
          <View style={styles.editorBar}>
            <TouchableOpacity style={styles.iconButton} onPress={closeEditor}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.editorBarTitle} numberOfLines={1}>
              {editing?.folder ?? openFolder ?? 'Notes'}
            </Text>
            {editing && !editing.deletedAt ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  toggleNotePinned(editing.id, user?.id);
                  setEditing({ ...editing, pinned: !editing.pinned });
                }}
              >
                <Ionicons
                  name={editing.pinned ? 'pin' : 'pin-outline'}
                  size={20}
                  color={editing.pinned ? '#ffd9a0' : colors.primary}
                />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.editorScroll}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={styles.editorTitle}
              placeholder="Title"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={draftTitle}
              onChangeText={setDraftTitle}
            />
            <Text style={styles.editorMeta}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <TextInput
              style={styles.editorBody}
              placeholder="Start writing…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={draftBody}
              onChangeText={setDraftBody}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logoText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.full,
  },
  foldersWrap: {
    padding: spacing.containerPadding,
    gap: 4,
    paddingBottom: 60,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: rounded.lg,
  },
  folderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: tc.textPrimary,
  },
  folderCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    fontVariant: ['tabular-nums'],
  },
  foldersHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    marginTop: 16,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.containerPadding,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: tc.textPrimary,
    paddingVertical: 0,
  },
  notesWrap: {
    padding: spacing.containerPadding,
    gap: 10,
    paddingBottom: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    marginTop: 40,
    fontSize: 13,
  },
  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 6,
  },
  noteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  noteDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  notePreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  notePreviewEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#14141C',
    borderRadius: rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tc.textPrimary,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tc.textPrimary,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: rounded.DEFAULT,
  },
  modalRowText: {
    fontSize: 15,
    color: tc.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 11,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: tc.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 14,
  },
  editorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  editorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  editorBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  editorScroll: {
    padding: spacing.containerPadding,
    paddingBottom: 80,
  },
  editorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tc.textPrimary,
    paddingVertical: 6,
  },
  editorMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 14,
  },
  editorBody: {
    fontSize: 15,
    color: tc.textPrimary,
    lineHeight: 22,
    minHeight: 320,
  },
});
