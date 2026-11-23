/** A single note row: title, date, two-line preview, folder and status badges. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale } from '../../../shared/components/meridian';
import { checklistProgress, previewFromBody } from '../markdown';
import type { Note } from '../types';
import HighlightedText from './HighlightedText';

interface Props {
  note: Note;
  folderName?: string | null;
  query?: string;
  hasLink?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export default function NoteRow({ note, folderName, query = '', hasLink, onPress, onLongPress }: Props) {
  const preview = previewFromBody(note.body_md);
  const progress = checklistProgress(note.body_md);
  const dateLabel = new Date(note.updated_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });

  return (
    <PressScale onPress={onPress} onLongPress={onLongPress} scale={0.99} style={styles.row}>
      <View style={styles.top}>
        {note.pinned ? <Ionicons name="pin" size={12} color={mc.amber} style={styles.pin} /> : null}
        <HighlightedText text={note.title} query={query} style={styles.title} numberOfLines={1} />
        <Text style={styles.date}>{dateLabel}</Text>
      </View>

      {note.locked ? (
        <View style={styles.locked}>
          <Ionicons name="lock-closed" size={12} color={mc.textDim} />
          <Text style={styles.lockedText}>Locked note</Text>
        </View>
      ) : (
        <HighlightedText text={preview || 'No additional text'} query={query} style={styles.preview} numberOfLines={2} />
      )}

      <View style={styles.bottom}>
        {folderName ? (
          <View style={styles.folder}>
            <Ionicons name="folder-outline" size={11} color={mc.textDim} />
            <Text style={styles.folderText} numberOfLines={1}>{folderName}</Text>
          </View>
        ) : null}
        {progress.total > 0 ? (
          <Label small color={mc.mint}>{progress.done}/{progress.total} done</Label>
        ) : null}
        {hasLink ? <Label small color={mc.sky}>Linked</Label> : null}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pin: { flexShrink: 0 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: mc.text },
  date: { fontSize: 11, color: mc.textDim },
  preview: { fontSize: 13, color: mc.textDim, lineHeight: 18 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  lockedText: { fontSize: 12, color: mc.textDim },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  folderText: { fontSize: 11, color: mc.textDim },
});
