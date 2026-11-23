/**
 * NoteQuickMenu — the long-press menu for a note row.
 * The full nine-item actions sheet arrives with screen 6; this covers the
 * quick actions available in the list (pin, move, delete).
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Card, Label, PressScale } from '../../../shared/components/meridian';
import type { Folder, Note } from '../types';

interface Props {
  note: Note | null;
  folders: Folder[];
  onClose: () => void;
  onPin: (note: Note) => void;
  onMove: (note: Note, folderId: string | null) => void;
  onDelete: (note: Note) => void;
}

export default function NoteQuickMenu({ note, folders, onClose, onPin, onMove, onDelete }: Props) {
  const [moving, setMoving] = React.useState(false);
  React.useEffect(() => { setMoving(false); }, [note?.id]);

  if (!note) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <Card style={styles.menu}>
            <Label>QUICK ACTIONS</Label>
            <Text style={styles.title} numberOfLines={1}>{note.title}</Text>
            <MenuRow
              icon={note.pinned ? 'pin-outline' : 'pin'}
              color={mc.amber}
              label={note.pinned ? 'Unpin note' : 'Pin note'}
              onPress={() => { onPin(note); onClose(); }}
            />
            <MenuRow
              icon="folder-open-outline"
              color={mc.textDim}
              label="Move to folder"
              onPress={() => setMoving(true)}
            />
            <MenuRow
              icon="trash-outline"
              color={mc.redSoft}
              label="Move to Recently deleted"
              onPress={() => { onDelete(note); onClose(); }}
            />
            {moving ? (
              <View style={styles.folders}>
                {folders.map((f) => (
                  <PressScale
                    key={f.id}
                    onPress={() => { onMove(note, f.id); onClose(); }}
                    scale={0.97}
                    style={styles.folderRow}
                  >
                    <Ionicons name="folder-outline" size={15} color={mc.textDim} />
                    <Text style={styles.folderText} numberOfLines={1}>{f.name}</Text>
                  </PressScale>
                ))}
                <PressScale onPress={() => { onMove(note, null); onClose(); }} scale={0.97} style={styles.folderRow}>
                  <Ionicons name="close-outline" size={15} color={mc.textDim} />
                  <Text style={styles.folderText}>No folder</Text>
                </PressScale>
              </View>
            ) : null}
          </Card>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function MenuRow({ icon, color, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} scale={0.98} style={styles.menuRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={mc.textGhost} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: mc.overlay, justifyContent: 'center', padding: 28 },
  menu: { gap: 4 },
  title: { fontSize: 15, color: mc.text, marginBottom: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  menuLabel: { flex: 1, fontSize: 14 },
  folders: { marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: mc.line, paddingTop: 6 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  folderText: { fontSize: 13, color: mc.text },
});
