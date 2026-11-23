/** Formatting sheet (screen 5) — style levels, emphasis, lists and blocks. */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale } from '../../../shared/components/meridian';
import type { FormatKind } from '../markdown';

interface Props {
  visible: boolean;
  activeStyle?: FormatKind;
  onFormat: (kind: FormatKind) => void;
  onClose: () => void;
}

export default function FormattingSheet({ visible, activeStyle, onFormat, onClose }: Props) {
  const choose = (kind: FormatKind) => { onFormat(kind); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.header}>
            <Label>Format</Label>
            <PressScale onPress={onClose} scale={0.9} accessibilityLabel="Close formatting" style={styles.close}>
              <Ionicons name="close" size={16} color={mc.textDim} />
            </PressScale>
          </View>

          <View style={styles.styles}>
            {STYLES.map((option) => (
              <PressScale
                key={option.kind}
                onPress={() => choose(option.kind)}
                scale={0.98}
                style={[styles.styleRow, activeStyle === option.kind && styles.styleRowActive]}
              >
                <Text style={[styles.styleLabel, option.style]}>{option.label}</Text>
                {activeStyle === option.kind ? (
                  <Ionicons name="checkmark" size={16} color={mc.amber} />
                ) : null}
              </PressScale>
            ))}
          </View>

          <View style={styles.grid}>
            {EMPHASIS.map((option) => (
              <PressScale key={option.kind} onPress={() => choose(option.kind)} scale={0.94} style={styles.cell}>
                <Text style={[styles.emphasis, option.style]}>{option.label}</Text>
              </PressScale>
            ))}
          </View>
          <View style={styles.grid}>
            {[...BLOCKS, ...STRUCTURE].map((option) => (
              <PressScale
                key={option.kind}
                onPress={() => choose(option.kind)}
                scale={0.94}
                style={[styles.cell, option.kind === 'checklist' && styles.cellAccent]}
              >
                <Ionicons name={option.icon} size={19} color={option.kind === 'checklist' ? mc.amber : mc.text} />
              </PressScale>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Inline style objects avoid referencing `styles` before its declaration.
const STYLES: Array<{ kind: FormatKind; label: string; style: any }> = [
  { kind: 'title', label: 'Title', style: { fontSize: 24, fontWeight: '700' } },
  { kind: 'heading', label: 'Heading', style: { fontSize: 19, fontWeight: '700' } },
  { kind: 'subheading', label: 'Subheading', style: { fontSize: 16, fontWeight: '600' } },
  { kind: 'body', label: 'Body', style: { fontSize: 15 } },
  { kind: 'mono', label: 'Monostyled', style: { fontSize: 14, fontFamily: 'monospace' } },
];

const EMPHASIS: Array<{ kind: FormatKind; label: string; style: any }> = [
  { kind: 'bold', label: 'B', style: { fontWeight: '700' } },
  { kind: 'italic', label: 'I', style: { fontStyle: 'italic' } },
  { kind: 'underline', label: 'U', style: { textDecorationLine: 'underline' } },
  { kind: 'strikethrough', label: 'S', style: { textDecorationLine: 'line-through' } },
];

const BLOCKS: Array<{ kind: FormatKind; icon: keyof typeof Ionicons.glyphMap }> = [
  { kind: 'bullet', icon: 'list-outline' },
  { kind: 'dash', icon: 'remove-outline' },
  { kind: 'numbered', icon: 'reorder-four-outline' },
  { kind: 'quote', icon: 'text-outline' },
];

const STRUCTURE: Array<{ kind: FormatKind; icon: keyof typeof Ionicons.glyphMap }> = [
  { kind: 'indent', icon: 'reorder-three-outline' },
  { kind: 'outdent', icon: 'reorder-two-outline' },
  { kind: 'checklist', icon: 'checkbox-outline' },
  { kind: 'table', icon: 'grid-outline' },
];

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: mc.overlay },
  sheet: { backgroundColor: mc.cardAlt, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: mc.raised, alignItems: 'center', justifyContent: 'center' },
  styles: { backgroundColor: mc.raised, borderRadius: mr.card, overflow: 'hidden' },
  styleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  styleRowActive: { backgroundColor: mc.amberDim },
  styleLabel: { color: mc.text },
  optTitle: { fontSize: 24, fontWeight: '700' },
  optHeading: { fontSize: 19, fontWeight: '700' },
  optSub: { fontSize: 16, fontWeight: '600' },
  optBody: { fontSize: 15 },
  optMono: { fontSize: 14, fontFamily: 'monospace' },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: mc.raised, alignItems: 'center', justifyContent: 'center' },
  cellAccent: { backgroundColor: mc.amberDim },
  emphasis: { fontSize: 18, color: mc.text },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike: { textDecorationLine: 'line-through' },
});
