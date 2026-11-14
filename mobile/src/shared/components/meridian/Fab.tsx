/**
 * Fab — the red circular action button.
 *
 * Used for "add" actions on the detail screens.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../theme/meridian';
import PressScale from './PressScale';

interface FabProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function Fab({
  icon,
  onPress,
  size = 40,
  color = mc.red,
  iconColor = mc.white,
  style,
  accessibilityLabel,
}: FabProps) {
  return (
    <PressScale
      onPress={onPress}
      scale={0.92}
      accessibilityLabel={accessibilityLabel}
      style={[styles.fab, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={iconColor} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
