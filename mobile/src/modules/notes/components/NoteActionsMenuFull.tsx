/**
 * Note actions menu (screen 6) — the full nine-item sheet.
 * Lock / Link to Meridian / Checklist-to-tasks are Phase 2: they are shown
 * with a "Later" tag rather than pretending to work.
 */
import React, { useState } from 'react';
import {
  Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale } from '../../../shared/components/meridian';
import type { Folder, Note } from '../types';

interface Props {
  visible: boolean;
  note: Note | null;
  folders: Folder[];
  tags: string[];
  onClose: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  onAddTag: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  getShareText: () => string;
}

export default function NoteActionsMenuFull({
  visible, note, folders, tags, onClose, onPin, onMove, onAddTag,
  onDuplicate, onDelete, getShareText,
}: Props) {
  const [sheet, setSheet] = useState<'none' | 'folders' | 'tag'>('none');
  const [tagName, setTagName] = useState('');
  React.useEffect(() => { setSheet('none'); setTagName(''); }, [note?.id, visible]);
  if (!note) return null;

  const share = async () => {
    onClose();
    try {
      await Share.share({ message: getShareText(), title: note.title });
    } catch { /* user cancelled */ }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.menu}>
          <Label>NOTE ACTIONS</Label>
          <Item icon={note.pinned ? 'pin-outline' : 'pin'} color={mc.amber} label={note.pinned ? 'Unpin note' : 'Pin note'} onPress={() => { onPin(); onClose(); }} />
          <Item icon="lock-closed-outline" color={mc.amber} label="Lock note" later onPress={onClose} />
          <Item icon="folder-open-outline" color={mc.textDim} label="Move to folder" onPress={() => setSheet('folders')} />
          <Item icon="pricetag-outline" color={mc.textDim} label="Add tag" onPress={() => setSheet('tag')} />
          <Item icon="link-outline" color={mc.sky} label="Link to Meridian" later onPress={onClose} />
          <Item icon="checkbox-outline" color={mc.mint} label="Turn checklist into tasks" later onPress={onClose} />
          <Item icon="copy-outline" color={mc.textDim} label="Duplicate" onPress={() => { onDuplicate(); onClose(); }} />
          <Item icon="share-outline" color={mc.textDim} label="Share as text" onPress={share} />
          <Item icon="trash-outline" color={mc.redSoft} label="Delete" onPress={() => { onDelete(); onClose(); }} />

          {sheet === 'folders' ? (
            <View style={styles.subSheet}>
              <Label>MOVE TO</Label>
              {folders.map((f) => (
                <PressScale key={f.id} onPress={() => { onMove(f.id); onClose(); }} scale={0.98} style={styles.subRow}>
                  <Ionicons name="folder-outline" size={16} color={mc.textDim} />
                  <Text style={styles.subText}>{f.name}</Text>
                </PressScale>
              ))}
              <PressScale onPress={() => { onMove(null); onClose(); }} scale={0.98} style={styles.subRow}>
                <Ionicons name="close-outline" size={16} color={mc.textDim} />
                <Text style={styles.subText}>No folder</Text>
              </PressScale>
            </View>
          ) : null}

          {sheet === 'tag' ? (
            <View style={styles.subSheet}>
              <Label>ADD TAG</Label>
              {tags.length > 0 ? <Text style={styles.existing}>{tags.map((t) => `#${t}`).join(' ')}</Text> : null}
              <TextInput
                style={styles.input}
                value={tagName}
                onChangeText={setTagName}
                placeholder="Tag name"
                placeholderTextColor={mc.textGhost}
                autoFocus
              />
              <PressScale
                onPress={() => { if (tagName.trim()) { onAddTag(tagName.trim()); onClose(); } }}
                scale={0.98}
                style={styles.addBtn}
              >
                <Text style={styles.addText}>Add tag</Text>
              </PressScale>
            </View>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Item({ icon, color, label, onPress, later }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
  later?: boolean;
}) {
  return (
    <PressScale onPress={onPress} scale={0.98} style={styles.row}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {later ? <Label small>LATER</Label> : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: mc.overlay },
  menu: { backgroundColor: mc.cardAlt, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 16, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowLabel: { flex: 1, fontSize: 14 },
  subSheet: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: mc.line, marginTop: 8, paddingTop: 10, gap: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  subText: { fontSize: 13, color: mc.text },
  existing: { fontSize: 12, color: mc.amber },
  input: { backgroundColor: mc.raised, borderRadius: mr.chip, paddingHorizontal: 14, paddingVertical: 11, color: mc.text, fontSize: 14 },
  addBtn: { alignItems: 'center', paddingVertical: 12, borderRadius: mr.chip, backgroundColor: mc.red },
  addText: { color: mc.white, fontWeight: '600', fontSize: 13 },
});
