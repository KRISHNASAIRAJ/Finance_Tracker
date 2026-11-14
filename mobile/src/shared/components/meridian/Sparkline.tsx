/**
 * Sparkline — a tiny trend line with no axes.
 *
 * The reference uses it inside holding rows.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';
import { smoothPath, toPoints } from './chartMath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Sparkline({
  data,
  width = 56,
  height = 24,
  color = '#3EE6B0',
  strokeWidth = 2,
}: SparklineProps) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  const path = useMemo(() => {
    if (data.length < 2) return '';
    return smoothPath(toPoints(data, width, height, 3, 3));
  }, [data, width, height]);

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: mm.draw,
      delay: 120,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, path, reduced]);

  if (!path) return <View style={{ width, height }} />;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <AnimatedPath
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={2000}
          strokeDashoffset={anim.interpolate({ inputRange: [0, 1], outputRange: [2000, 0] })}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'transparent' },
});
