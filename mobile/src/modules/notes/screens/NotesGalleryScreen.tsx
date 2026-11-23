/** Gallery view (screen 2) — two-column note cards with previews and badges. */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, mm } from '../../../shared/theme/meridian';
import {
  Card, EmptyState, Fab, Label, PressScale, Rise, Screen, TopBar,
} from '../../../shared/components/meridian';
import { useNotesStore } from '../store';
import { useNotesBootstrap } from '../hooks/useNotesBootstrap';
import { checklistProgress, previewFromBody } from '../markdown';
import type { Note } from '../types';

export default function NotesGalleryScreen() {
  const navigation = useNavigation();
  const { error } = useNotesBootstrap();
  const notes = useNotesStore((s) => s.notes);
  const folders = useNotesStore((s) => s.folders);
  const create = useNotesStore((s) => s.create);

  const visible = useMemo(
    () => [...notes].filter((n) => !n.deleted_at)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)),
    [notes]
  );

  const open = (note: Note) => (navigation as any).navigate('NotesV2Editor', { noteId: note.id });
  const newNote = async () => {
    const note = await create('');
    open(note);
  };

  return (
    <Screen
      bottomInset={96}
      floating={
        <View style={styles.fabSlot}>
          <Fab icon="pencil" size={52} onPress={newNote} accessibilityLabel="New note" />
        </View>
      }
    >
      <TopBar
        title="Gallery"
        variant="center"
        onBack={() => navigation.goBack()}
        right={
          <PressScale
            onPress={() => (navigation as any).navigate('NotesV2List')}
            scale={0.9}
            accessibilityLabel="List view"
            style={styles.headerBtn}
          >
            <Ionicons name="list-outline" size={18} color={mc.amber} />
          </PressScale>
        }
      />

      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load notes" subtitle={error} />
      ) : visible.length === 0 ? (
        <EmptyState icon="images-outline" title="No notes yet" subtitle="Tap the pencil to create one." />
      ) : (
        <View style={styles.grid}>
          {visible.map((note, i) => {
            const progress = checklistProgress(note.body_md);
            const folderName = folders.find((f) => f.id === note.folder_id)?.name;
            return (
              <Rise key={note.id} index={Math.min(i, 8)} step={mm.stagger} distance={10}>
                <PressScale onPress={() => open(note)} scale={0.98}>
                  <Card style={styles.card}>
                    <View style={styles.cardTop}>
                      {note.pinned ? <Ionicons name="pin" size={11} color={mc.amber} /> : null}
                      <Text style={styles.title} numberOfLines={1}>{note.title}</Text>
                    </View>

                    {note.locked ? (
                      <View style={styles.locked}>
                        <View style={styles.blurred}>
                          <Text style={styles.preview} numberOfLines={3}>
                            Locked note content is hidden until you unlock it.
                          </Text>
                        </View>
                        <Ionicons name="lock-closed" size={22} color={mc.amber} style={styles.lockIcon} />
                      </View>
                    ) : (
                      <>
                        <Text style={styles.preview} numberOfLines={3}>
                          {previewFromBody(note.body_md) || 'No additional text'}
                        </Text>
                        {progress.total > 0 ? (
                          <View style={styles.checklist}>
                            <Ionicons name="checkbox-outline" size={12} color={mc.mint} />
                            <Text style={styles.checklistText}>{progress.done} of {progress.total} done</Text>
                          </View>
                        ) : null}
                        {folderName ? (
                          <Label small style={styles.folder}>{folderName}</Label>
                        ) : null}
                      </>
                    )}
                    <Text style={styles.date}>
                      {new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </Card>
                </PressScale>
              </Rise>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', minHeight: 150, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { flex: 1, fontSize: 14, fontWeight: '600', color: mc.text },
  preview: { fontSize: 12, color: mc.textDim, lineHeight: 17 },
  checklist: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checklistText: { fontSize: 11, color: mc.mint },
  folder: { marginTop: 2 },
  date: { fontSize: 10, color: mc.textGhost, marginTop: 'auto' },
  locked: { position: 'relative', minHeight: 70, justifyContent: 'center' },
  blurred: { opacity: 0.45 },
  lockIcon: { position: 'absolute', alignSelf: 'center' },
  fabSlot: { position: 'absolute', right: 18, bottom: 18 },
});
