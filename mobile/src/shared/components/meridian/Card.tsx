/**
 * Card — the flat Meridian panel.
 *
 * One surface (#131316), a 26px radius and NO border. Tinted variants exist
 * for the panels that carry a meaning (a red "service due" panel, a violet
 * sleep header, a mint money note).
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { mc, mr } from '../../theme/meridian';

export type CardTone = 'default' | 'alt' | 'red' | 'violet' | 'mint' | 'amber' | 'sky';

const TONES: Record<CardTone, string> = {
  default: mc.card,
  alt: mc.cardAlt,
  red: mc.redTint,
  violet: mc.violetTint,
  mint: mc.mintDim,
  amber: mc.amberDim,
  sky: mc.skyDim,
};

interface CardProps {
  children: React.ReactNode;
  /** The surface tint. */
  tone?: CardTone;
  /** Padding inside the card (the reference uses 14). */
  pad?: boolean | number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, tone = 'default', pad = true, radius = mr.card, style }: CardProps) {
  const padding = pad === true ? 14 : pad === false ? 0 : pad;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: TONES[tone], borderRadius: radius, padding: padding as number },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
