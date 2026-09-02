/**
 * GlassCard — frosted glass panel. Translucent surface, hairline highlight border,
 * and an optional interior colour tint. Flat by design: no elevation/shadows so
 * cards sit cleanly beside each other without stacking.
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, glow as glowColors } from '../theme/tracend';

type GlowKey = keyof typeof glowColors;

interface GlassCardProps {
  children: React.ReactNode;
  glow?: GlowKey | 'none';
  radius?: number;
  pad?: boolean;
  style?: ViewStyle;
}

export default function GlassCard({ children, glow, radius = 28, pad = true, style }: GlassCardProps) {
  const accent = glow && glow !== 'none' ? ((glowColors as any)[glow] as string) : undefined;
  return (
    <View style={[styles.wrapper, { borderRadius: radius }, style]}>
      {/* Frosted gradient fill */}
      <LinearGradient
        colors={['rgba(255,255,255,0.085)', 'rgba(255,255,255,0.028)']}
        style={[styles.fill, { borderRadius: radius, padding: pad ? 18 : 0 }]}
      >
        {/* Interior accent wash — clipped, top-anchored, very subtle */}
        {accent && (
          <LinearGradient
            colors={[`${accent}1f`, 'rgba(0,0,0,0)']}
            style={styles.tint}
            pointerEvents="none"
          />
        )}
        {/* Top highlight line — the classic glass edge */}
        <View style={styles.highlight} pointerEvents="none" />
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    backgroundColor: 'rgba(18,18,24,0.55)',
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    overflow: 'hidden',
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
