/**
 * StackedShareBar — a 100% stacked bar with 3px gaps between the segments.
 *
 * Each segment animates its width from 0 (the reference's `w` keyframe).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { clamp01 } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

export interface ShareSegment {
  key: string;
  value: number;
  color: string;
  /** Force a minimum visible width (the reference keeps slivers visible). */
  minWidth?: number;
}

interface StackedShareBarProps {
  segments: ShareSegment[];
  height?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export default function StackedShareBar({
  segments,
  height = 12,
  gap = 3,
  style,
}: StackedShareBarProps) {
  const reduced = useReducedMotion();
  const anims = useRef<Animated.Value[]>([]).current;

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

  useEffect(() => {
    anims.length = segments.length;
    segments.forEach((_, i) => {
      if (!anims[i]) anims[i] = new Animated.Value(reduced ? 1 : 0);
    });
    if (reduced) {
      anims.forEach((a) => a.setValue(1));
      return;
    }
    Animated.parallel(
      anims.map((a, i) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 900,
          delay: 150 + i * 60,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [segments.length, reduced]);

  return (
    <View style={[styles.row, { height, gap }, style]}>
      {segments.map((s, i) => {
        const share = total > 0 ? clamp01(s.value / total) : 0;
        const width = s.minWidth ? `${Math.max(share * 100, s.minWidth)}%` : `${share * 100}%`;
        const a = anims[i];
        return (
          <Animated.View
            key={s.key}
            style={[
              styles.seg,
              {
                backgroundColor: s.color,
                width: a
                  ? (a.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', width] as [string, string],
                    }) as unknown as number)
                  : (width as unknown as number),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  seg: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
});
