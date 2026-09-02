/**
 * GlowText — text with a soft, tight colour glow (subtle, not neon).
 * Uses platform textShadow with a low-alpha colour derived from the hex token.
 */
import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { glow as glowColors } from '../theme/tracend';

type GlowColor = keyof typeof glowColors;

interface GlowTextProps extends TextProps {
  glow?: GlowColor;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
}

export default function GlowText({
  glow = 'indigo',
  size = 38,
  weight = '800',
  color = '#ffffff',
  style,
  children,
  ...rest
}: GlowTextProps) {
  const glowColor = ((glowColors as any)[glow] as string) + '55';
  return (
    <Text
      style={[
        {
          fontSize: size,
          fontWeight: weight,
          color,
          letterSpacing: -0.5,
          textShadowColor: glowColor,
          textShadowRadius: 6,
          textShadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}