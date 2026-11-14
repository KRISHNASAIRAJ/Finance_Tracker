/**
 * ProgressBar — a track with a fill that grows from 0 to its value.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { clamp01, mc } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export default function ProgressBar({
  value,
  color = mc.mint,
  trackColor = mc.track,
  height = 10,
  radius,
  style,
  duration = 900,
}: ProgressBarProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const pct = clamp01(value);

  useEffect(() => {
    if (reduced) {
      anim.setValue(pct);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: pct,
      duration,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, anim, reduced, duration]);

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: radius ?? height / 2, backgroundColor: trackColor },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: radius ?? height / 2,
            backgroundColor: color,
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
