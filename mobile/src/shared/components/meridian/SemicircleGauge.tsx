/**
 * SemicircleGauge — a 180° gauge that sweeps to its value in 0.8s.
 *
 * The reference uses it for "92% of interval used" on the service screen.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { clamp01, mc, mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SemicircleGaugeProps {
  /** 0..1 */
  progress: number;
  width?: number;
  height?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export default function SemicircleGauge({
  progress,
  width = 170,
  height = 92,
  stroke = 12,
  color = mc.redSoft,
  trackColor = mc.redDim,
  children,
  style,
  duration = mm.sweep,
}: SemicircleGaugeProps) {
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

  const pad = stroke / 2 + 2;
  const r = (width - pad * 2) / 2;
  const cx = width / 2;
  const cy = height - pad;
  const d = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  // The arc length of a 180° sweep is pi * r.
  const len = Math.PI * r;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Path d={d} stroke={trackColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <AnimatedPath
          d={d}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={anim.interpolate({
            inputRange: [0, 1],
            outputRange: [len, len * (1 - pct)],
          })}
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
