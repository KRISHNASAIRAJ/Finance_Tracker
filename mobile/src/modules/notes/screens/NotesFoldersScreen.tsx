/** Folders and tags (screen 3) — smart folders, folders, tags and trash. */
import React, { useMemo, useState } from 'react';
import {
  Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, mm } from '../../../shared/theme/meridian';
import {
  Card, Chip, EmptyState, IconTile, Label, PressScale, Rise, Screen, TopBar,
} from '../../../shared/components/meridian';
import { useNotesStore } from '../store';
import { useNotesBootstrap } from '../hooks/useNotesBootstrap';

interface Row {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  count: number;
}

export default function NotesFoldersScreen() {
  const navigation = useNavigation();
  const { error } = useNotesBootstrap();
  const notes = useNotesStore((s) => s.notes);
  const folders = useNotesStore((s) => s.folders);
  const tags = useNotesStore((s) => s.tags);
  const noteTags = useNotesStore((s) => s.noteTags);
  const noteLinks = useNotesStore((s) => s.noteLinks);
  const addFolder = useNotesStore((s) => s.addFolder);
  const purgeExpired = useNotesStore((s) => s.purgeExpired);

  const [newFolder, setNewFolder] = useState(false);
  const [name, setName] = useState('');

  const counts = useMemo(() => {
    const alive = notes.filter((n) => !n.deleted_at);
    return {
      all: alive.length,
      pinned: alive.filter((n) => n.pinned).length,
      checklists: alive.filter((n) => /^\s*[-*+]\s+\[[ xX]\]/.test(n.body_md)).length,
      locked: alive.filter((n) => n.locked).length,
      linked: new Set(noteLinks.map((l) => l.note_id)).size,
      trashed: notes.filter((n) => n.deleted_at).length,
      folders: new Map(folders.map((f) => [f.id, alive.filter((n) => n.folder_id === f.id).length])),
      tags: new Map(tags.map((t) => [t.id, noteTags.filter((nt) => nt.tag_id === t.id).length])),
    };
  }, [notes, folders, tags, noteTags, noteLinks]);

  const smart: Row[] = [
    { id: 'all', label: 'All notes', icon: 'document-text-outline', color: mc.amber, count: counts.all },
    { id: 'pinned', label: 'Pinned', icon: 'pin-outline', color: mc.amber, count: counts.pinned },
    { id: 'checklists', label: 'Checklists', icon: 'checkbox-outline', color: mc.amber, count: counts.checklists },
    { id: 'locked', label: 'Locked', icon: 'lock-closed-outline', color: mc.amber, count: counts.locked },
    { id: 'linked', label: 'Linked to Meridian', icon: 'link-outline', color: mc.sky, count: counts.linked },
  ];

  const userFolders: Row[] = folders.map((f) => ({
    id: f.id,
    label: f.name,
    icon: 'folder-outline',
    color: mc.textDim,
    count: counts.folders.get(f.id) ?? 0,
  }));

  const open = (id: string) => (navigation as any).navigate('NotesV2List', { folder: id });

  const saveFolder = async () => {
    const trimmed = name.trim();
    if (trimmed) await addFolder(trimmed);
    setName('');
    setNewFolder(false);
  };

  return (
    <Screen bottomInset={40}>
      <TopBar
        title="Folders & tags"
        variant="center"
        onBack={() => navigation.goBack()}
        right={
          <PressScale onPress={() => navigation.goBack()} scale={0.9} accessibilityLabel="Done" style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </PressScale>
        }
      />

      {error ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load notes" subtitle={error} />
      ) : (
        <>
          <Label style={styles.section}>SMART FOLDERS</Label>
          <Card pad={false}>
            {smart.map((row, i) => (
              <Rise key={row.id} index={i} step={mm.stagger} distance={8}>
                <ListRow row={row} index={i} onPress={() => open(row.id)} />
              </Rise>
            ))}
          </Card>

          <Label style={styles.section}>FOLDERS</Label>
          {userFolders.length === 0 ? (
            <EmptyState icon="folder-outline" title="No folders yet" subtitle="Use New folder to add one." />
          ) : (
            <Card pad={false}>
              {userFolders.map((row, i) => (
                <Rise key={row.id} index={i} step={mm.stagger} distance={8}>
                  <ListRow row={row} index={i} onPress={() => open(row.id)} />
                </Rise>
              ))}
            </Card>
          )}

          {tags.length > 0 ? (
            <>
              <Label style={styles.section}>TAGS</Label>
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <Chip key={tag.id} color={mc.amber} variant="soft" size="sm">
                    #{tag.name} · {counts.tags.get(tag.id) ?? 0}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}

          <Card pad={false} style={styles.trashCard}>
            <ListRow
              row={{
                id: 'trash',
                label: 'Recently deleted',
                icon: 'trash-outline',
                color: mc.redSoft,
                count: counts.trashed,
              }}
              index={0}
              onPress={() => open('trash')}
            />
          </Card>
          <PressScale onPress={() => setNewFolder(true)} scale={0.98} style={styles.newFolder}>
            <Ionicons name="folder-open-outline" size={18} color={mc.amber} />
            <Text style={styles.newFolderText}>New folder</Text>
          </PressScale>
          {counts.trashed > 0 ? (
            <PressScale onPress={purgeExpired} scale={0.98} style={styles.purge}>
              <Text style={styles.purgeText}>Purge items older than 30 days</Text>
            </PressScale>
          ) : null}
        </>
      )}

      <Modal visible={newFolder} transparent animationType="fade" onRequestClose={() => setNewFolder(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setNewFolder(false)}>
          <TouchableOpacity activeOpacity={1}>
            <Card style={styles.modal}>
              <Label>NEW FOLDER</Label>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Folder name"
                placeholderTextColor={mc.textGhost}
                autoFocus
              />
              <View style={styles.modalActions}>
                <PressScale onPress={() => setNewFolder(false)} scale={0.97} style={styles.cancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </PressScale>
                <PressScale onPress={saveFolder} scale={0.97} style={styles.save}>
                  <Text style={styles.saveText}>Create</Text>
                </PressScale>
              </View>
            </Card>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function ListRow({ row, index, onPress }: { row: Row; index: number; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scale={0.99} style={[styles.row, index > 0 && styles.divider]}>
      <IconTile icon={row.icon} color={row.color} size={34} radius={12} />
      <Text style={styles.rowLabel} numberOfLines={1}>{row.label}</Text>
      <Text style={styles.rowCount}>{row.count}</Text>
      <Ionicons name="chevron-forward" size={15} color={mc.textGhost} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  doneBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  doneText: { fontSize: 13, color: mc.amber, fontWeight: '600' },
  section: { marginTop: 10, marginBottom: 4, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: 'transparent' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: mc.line },
  rowLabel: { flex: 1, fontSize: 14, color: mc.text },
  rowCount: { fontSize: 13, color: mc.textDim, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trashCard: { marginTop: 16 },
  newFolder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
  newFolderText: { fontSize: 14, color: mc.amber, fontWeight: '600' },
  purge: { paddingVertical: 8, paddingHorizontal: 4 },
  purgeText: { fontSize: 12, color: mc.redSoft },
  backdrop: { flex: 1, backgroundColor: mc.overlay, justifyContent: 'center', padding: 28 },
  modal: { gap: 12 },
  input: {
    backgroundColor: mc.raised, borderRadius: mr.chip, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: mc.text,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancel: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: mr.chip, backgroundColor: mc.raised },
  cancelText: { fontSize: 13, color: mc.textDim },
  save: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: mr.chip, backgroundColor: mc.red },
  saveText: { fontSize: 13, color: mc.white, fontWeight: '600' },
});
