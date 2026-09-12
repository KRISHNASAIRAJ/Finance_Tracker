/**
 * Entrance — shared staggered entrance animation (fade + rise).
 * Core Animated only (native driver, no extra deps).
 *
 * Usage: wrap any card with <Entrance index={i}>…</Entrance> — cards rise
 * and fade in sequence (60ms stagger) on first mount.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle } from 'react-native';

interface EntranceProps {
  /** Stagger position (0 = first card). Higher = later entrance. */
  index: number;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Per-step delay in ms (default 60). */
  step?: number;
  /** Vertical travel distance (default 18). */
  distance?: number;
  /** Duration in ms (default 420). */
  duration?: number;
}

export default function Entrance({
  index,
  children,
  style,
  step = 60,
  distance = 18,
  duration = 420,
}: EntranceProps) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay: Math.min(index, 8) * step,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index, step, duration]);

  const animatedStyle = {
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[animatedStyle, styles.base, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'transparent' },
});
