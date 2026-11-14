/**
 * Label — the all-caps caption used on every Meridian card.
 *
 * 11px, 1.2px letter spacing, grey. Never used for a value.
 */
import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { mc } from '../../theme/meridian';

interface LabelProps {
  children: React.ReactNode;
  /** Smaller (10px) variant. */
  small?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function Label({ children, small, color, style, numberOfLines }: LabelProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        small ? styles.small : styles.base,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: mc.textDim,
    textTransform: 'uppercase',
  },
  small: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    color: mc.textDim,
    textTransform: 'uppercase',
  },
});
