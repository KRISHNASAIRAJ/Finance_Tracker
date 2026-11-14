/**
 * IconTile — a rounded square holding one icon.
 *
 * The background is a dark tint of the icon's own colour, so a tile always
 * reads as "this icon's category".
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { alpha, mc, mr } from '../../theme/meridian';

interface IconTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** The icon + tint colour. */
  color?: string;
  /** Override the tinted background. */
  background?: string;
  size?: number;
  radius?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

export default function IconTile({
  icon,
  color = mc.textDim,
  background,
  size = 38,
  radius = mr.tile,
  iconSize,
  style,
}: IconTileProps) {
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: background ?? alpha(color, 0.13),
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.45)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
