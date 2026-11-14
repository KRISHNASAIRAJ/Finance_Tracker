/**
 * Ring — a circular progress ring that sweeps to its value in 0.8s.
 *
 * Used for habit completion ("3/8"), task completion and goal progress.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { clamp01, mc, mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** Render a dashed track (the habit ring in the reference). */
  dashed?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export default function Ring({
  progress,
  size = 116,
  stroke = 9,
  color = mc.red,
  trackColor = mc.track,
  dashed,
  children,
  style,
  duration = mm.sweep,
}: RingProps) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const pct = clamp01(progress);

  useEffect(() => {
    if (reduced) {
      anim.setValue(pct);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: pct,
      duration,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, anim, duration, reduced]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = dashed ? `${circumference * 0.08} ${circumference * 0.02}` : undefined;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={anim.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, circumference * (1 - pct)],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
