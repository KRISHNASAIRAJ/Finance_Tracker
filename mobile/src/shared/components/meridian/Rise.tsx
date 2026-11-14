/**
 * Rise — the staggered card entrance.
 *
 * Cards fade up 14px in sequence (50ms apart, 600ms each) exactly like the
 * reference keyframes. Honours the system "reduce motion" setting.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

interface RiseProps {
  /** Stagger position (0 = first card). */
  index?: number;
  children: React.ReactNode;
  /** Per-card delay in ms. */
  step?: number;
  /** Vertical travel in px. */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Rise({
  index = 0,
  children,
  step = mm.stagger,
  distance = 14,
  duration = mm.rise,
  style,
}: RiseProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay: Math.min(index, 8) * step,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index, step, duration, reduced]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'transparent' },
});
