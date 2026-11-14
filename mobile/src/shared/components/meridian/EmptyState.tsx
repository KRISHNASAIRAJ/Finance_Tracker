/**
 * EmptyState — the centred "nothing here yet" panel.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../theme/meridian';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function EmptyState({ icon, title, subtitle, children }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon ? <Ionicons name={icon} size={28} color={mc.textGhost} /> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  title: {
    fontSize: 14,
    color: mc.text,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 12,
    color: mc.textDim,
  },
});
