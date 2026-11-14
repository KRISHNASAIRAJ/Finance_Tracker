/**
 * StatTile — a small card with an icon, a value and a label.
 *
 * The reference uses these in a 3-up row (bank / wallets / lent).
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../theme/meridian';
import PressScale from './PressScale';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** The accent colour for the icon. */
  color?: string;
  value: string;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function StatTile({ icon, color = mc.sky, value, label, onPress, style }: StatTileProps) {
  const inner = (
    <View style={[styles.tile, style]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <PressScale onPress={onPress} scale={0.97} style={styles.press}>
      {inner}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  press: { flex: 1, backgroundColor: 'transparent' },
  tile: {
    flex: 1,
    backgroundColor: mc.card,
    borderRadius: 26,
    padding: 12,
    gap: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.text,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: mc.textDim,
    fontWeight: '500',
  },
});
