/** Keyboard toolbar (screen 4) — formatting shortcuts above the keyboard. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { PressScale } from '../../../shared/components/meridian';
import type { FormatKind } from '../markdown';

interface Props {
  onFormat: (kind: FormatKind) => void;
  onOpenFormat: () => void;
  onTogglePreview: () => void;
  previewing: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenActions: () => void;
}

export default function KeyboardToolbar({
  onFormat, onOpenFormat, onTogglePreview, previewing,
  onUndo, onRedo, canUndo, canRedo, onOpenActions,
}: Props) {
  return (
    <View style={styles.toolbar}>
      <Tool onPress={onOpenFormat} label="Aa" accessibilityLabel="Formatting options" accent />
      <Tool onPress={onUndo} icon="arrow-undo-outline" disabled={!canUndo} accessibilityLabel="Undo" />
      <Tool onPress={onRedo} icon="arrow-redo-outline" disabled={!canRedo} accessibilityLabel="Redo" />
      <Tool onPress={() => onFormat('checklist')} icon="checkbox-outline" accessibilityLabel="Checklist" accent />
      <Tool onPress={() => onFormat('heading')} icon="text-outline" accessibilityLabel="Heading" />
      <Tool onPress={onTogglePreview} icon={previewing ? 'pencil-outline' : 'eye-outline'} accessibilityLabel={previewing ? 'Edit' : 'Preview'} />
      <Tool onPress={onOpenActions} icon="ellipsis-horizontal" accessibilityLabel="Note actions" />
    </View>
  );
}

function Tool({ onPress, icon, label, disabled, accessibilityLabel, accent }: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  accent?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      scale={0.9}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[styles.tool, disabled && styles.disabled]}
    >
      {label ? (
        <Text style={[styles.label, accent && styles.accent]}>{label}</Text>
      ) : (
        <Ionicons name={icon!} size={19} color={accent ? mc.amber : mc.text} />
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: mc.cardAlt, borderRadius: 24, paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: mc.line,
  },
  tool: { width: 40, height: 40, borderRadius: mr.tile, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  label: { fontSize: 16, fontWeight: '600', color: mc.text },
  accent: { color: mc.amber },
});
