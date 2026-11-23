/**
 * Note editor (screens 4–6) — autosave, title/preview rules, Markdown styling,
 * checklists, formatting sheet, keyboard toolbar, undo/redo, tags and sharing.
 *
 * Local-first: every change is debounced into the Zustand/AsyncStorage store
 * after 500 ms and flushed on leave or AppState background, before sync.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../../shared/theme/meridian';
import { Chip, PressScale, TopBar } from '../../../shared/components/meridian';
import { useNotesBootstrap } from '../hooks/useNotesBootstrap';
import { useNotesStore } from '../store';
import {
  AUTOSAVE_MS,
} from '../types';
import {
  exportAsText, FormatKind, formatRange, titleFromBody,
} from '../markdown';
import {
  currentText, flushDraft, makeHistory, pushHistory, redo, undo,
} from '../editorHistory';
import MarkdownBody from '../components/MarkdownBody';
import FormattingSheet from '../components/FormattingSheet';
import KeyboardToolbar from '../components/KeyboardToolbar';
import NoteActionsMenuFull from '../components/NoteActionsMenuFull';

export default function NotesEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const noteId = (route.params as any)?.noteId as string | undefined;
  useNotesBootstrap();

  const note = useNotesStore((s) => s.notes.find((n) => n.id === noteId));
  const folders = useNotesStore((s) => s.folders);
  const tags = useNotesStore((s) => s.tags);
  const noteTags = useNotesStore((s) => s.noteTags);
  const noteLinks = useNotesStore((s) => s.noteLinks);
  const updateBody = useNotesStore((s) => s.updateBody);
  const togglePin = useNotesStore((s) => s.togglePin);
  const move = useNotesStore((s) => s.move);
  const addTag = useNotesStore((s) => s.addTag);
  const duplicateNote = useNotesStore((s) => s.create);
  const trash = useNotesStore((s) => s.trash);
  const purge = useNotesStore((s) => s.purge);

  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState(() => makeHistory(''));
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [previewing, setPreviewing] = useState(false);
  const [formatVisible, setFormatVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const draftRef = useRef(draft);
  const savedRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    if (!note || initializedRef.current) return;
    initializedRef.current = true;
    setDraft(note.body_md);
    draftRef.current = note.body_md;
    savedRef.current = note.body_md;
    setHistory(makeHistory(note.body_md));
  }, [note]);

  const flush = useCallback(async () => {
    if (!noteId || savedRef.current === null) return;
    const text = draftRef.current;
    if (text === savedRef.current) return;
    await flushDraft(noteId, text, updateBody);
    savedRef.current = text;
  }, [noteId, updateBody]);

  // 500 ms after the last keystroke.
  useEffect(() => {
    if (!noteId || savedRef.current === null || draft === savedRef.current) return;
    const timer = setTimeout(() => { flush().catch(() => {}); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, noteId, flush]);

  // Process death / backgrounding must not lose text.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush().catch(() => {});
    });
    return () => sub.remove();
  }, [flush]);

  useEffect(() => () => { flush().catch(() => {}); }, [flush]);

  const applyText = (text: string) => {
    setDraft(text);
    draftRef.current = text;
    setHistory((h) => pushHistory(h, text));
  };

  const applyFormat = (kind: FormatKind) => {
    const result = formatRange(draftRef.current, selection.start, selection.end, kind);
    applyText(result.text);
    setSelection({ start: result.selectionStart, end: result.selectionEnd });
    if (!previewing) {
      setTimeout(() => inputRef.current?.setSelection?.(result.selectionStart, result.selectionEnd), 0);
    }
  };

  const doUndo = () => {
    const next = undo(history);
    setHistory(next);
    setDraft(currentText(next));
    draftRef.current = currentText(next);
  };

  const doRedo = () => {
    const next = redo(history);
    setHistory(next);
    setDraft(currentText(next));
    draftRef.current = currentText(next);
  };

  const handleBack = async () => {
    // Empty notes are deleted automatically when closed.
    if (note && !draftRef.current.trim()) {
      await purge(note.id);
    } else {
      await flush();
    }
    navigation.goBack();
  };

  const noteTagNames = noteTags
    .filter((nt) => nt.note_id === noteId)
    .map((nt) => tags.find((t) => t.id === nt.tag_id)?.name)
    .filter(Boolean) as string[];

  const links = noteLinks.filter((l) => l.note_id === noteId);

  const shareText = () => exportAsText(draftRef.current, noteTagNames);

  if (!note) {
    return (
      <View style={styles.root}>
        <TopBar title="Note" variant="center" onBack={() => navigation.goBack()} />
        <Text style={styles.missing}>Note not found — it may have been deleted.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={8}
    >
      <TopBar
        title="Notes"
        variant="center"
        onBack={handleBack}
        right={
          <View style={styles.headerActions}>
            <PressScale
              onPress={() => setActionsVisible(true)}
              scale={0.9}
              accessibilityLabel="Share note"
              style={styles.headerBtn}
            >
              <Ionicons name="share-outline" size={18} color={mc.amber} />
            </PressScale>
            <PressScale
              onPress={() => setActionsVisible(true)}
              scale={0.9}
              accessibilityLabel="Note actions"
              style={styles.headerBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={mc.amber} />
            </PressScale>
          </View>
        }
      />

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.dateLine}>
          {new Date(note.updated_at).toLocaleString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
        </Text>
        <Text style={styles.title}>{titleFromBody(draft)}</Text>

        {previewing ? (
          <MarkdownBody
            bodyMd={draft}
            onToggleChecklist={(_lineIndex, newBody) => applyText(newBody)}
          />
        ) : (
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={draft}
            onChangeText={applyText}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="Start writing…"
            placeholderTextColor={mc.textGhost}
            multiline
            textAlignVertical="top"
          />
        )}

        {noteTagNames.length > 0 || links.length > 0 ? (
          <View style={styles.chips}>
            {links.map((l) => (
              <Chip key={`${l.entity_type}-${l.entity_id}`} color={mc.sky} variant="soft" size="sm" icon="link-outline">
                {l.missing ? `${l.entity_type} (missing)` : l.entity_type}
              </Chip>
            ))}
            {noteTagNames.map((name) => (
              <Chip key={name} color={mc.amber} variant="soft" size="sm">#{name}</Chip>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.toolbarSlot}>
        <KeyboardToolbar
          onFormat={applyFormat}
          onOpenFormat={() => setFormatVisible(true)}
          onTogglePreview={() => setPreviewing((p) => !p)}
          previewing={previewing}
          onUndo={doUndo}
          onRedo={doRedo}
          canUndo={history.index > 0}
          canRedo={history.index < history.entries.length - 1}
          onOpenActions={() => setActionsVisible(true)}
        />
      </View>

      <FormattingSheet
        visible={formatVisible}
        onFormat={applyFormat}
        onClose={() => setFormatVisible(false)}
      />
      <NoteActionsMenuFull
        visible={actionsVisible}
        note={note}
        folders={folders}
        tags={noteTagNames}
        onClose={() => setActionsVisible(false)}
        onPin={() => togglePin(note.id)}
        onMove={(folderId) => move(note.id, folderId)}
        onAddTag={(name) => addTag(note.id, name)}
        onDuplicate={async () => {
          const copy = await duplicateNote(draftRef.current, note.folder_id);
          await addTag(copy.id, 'copy');
        }}
        onDelete={() => { trash(note.id); navigation.goBack(); }}
        getShareText={shareText}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mc.canvas },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 18 },
  dateLine: { textAlign: 'center', fontSize: 12, color: mc.textGhost, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '600', color: mc.text, letterSpacing: -0.4, marginBottom: 10 },
  input: { fontSize: 15, lineHeight: 22, color: mc.text, minHeight: 320 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  toolbarSlot: { paddingHorizontal: 12, paddingVertical: 8 },
  missing: { color: mc.textDim, textAlign: 'center', marginTop: 40 },
});
