/**
 * Chip — a small pill of text.
 *
 * 'soft'  tinted background + accent text (the common case)
 * 'solid' accent background + ink text
 * 'plain' neutral raised background + secondary text
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { alpha, mc, mr } from '../../theme/meridian';

type ChipVariant = 'soft' | 'solid' | 'plain';

interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  /** The accent colour. */
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** 'sm' = 11px tag, 'md' = 12px pill. */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export default function Chip({
  children,
  variant = 'soft',
  color = mc.textDim,
  icon,
  size = 'md',
  style,
}: ChipProps) {
  const bg =
    variant === 'solid' ? color : variant === 'soft' ? alpha(color, 0.16) : mc.raised;
  const fg = variant === 'solid' ? mc.ink : variant === 'soft' ? color : mc.textDim;

  return (
    <View
      style={[
        styles.chip,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg, borderRadius: size === 'sm' ? mr.tag : mr.chip },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 10 : 12} color={fg} /> : null}
      <Text style={[styles.text, size === 'sm' ? styles.textSm : styles.textMd, { color: fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontWeight: '600',
  },
  textMd: {
    fontSize: 12,
  },
  textSm: {
    fontSize: 11,
  },
});
