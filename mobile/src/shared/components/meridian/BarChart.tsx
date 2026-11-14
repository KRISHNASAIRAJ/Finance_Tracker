/**
 * BarChart — bars that grow upward from the baseline.
 *
 * Each bar keeps its own colour so a chart can mix "normal" and "highlighted"
 * bars (the reference's today's bar is red, the rest are dim).
 *
 * When `onSelect` is supplied the chart becomes interactive: tapping a bar
 * highlights it and reports its index, so the screen can show a readout.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { mc, mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface BarDatum {
  label?: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  width: number;
  height?: number;
  /** The colour of a bar with no explicit colour. */
  color?: string;
  /** Space between the bars. */
  gap?: number;
  radius?: number;
  /** Draw a dashed horizontal reference line. */
  reference?: number;
  referenceColor?: string;
  /** Tap a bar to select it. */
  onSelect?: (index: number) => void;
  /** The currently selected bar. */
  selectedIndex?: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export default function BarChart({
  data,
  width,
  height = 100,
  color = mc.barDim,
  gap = 6,
  radius = 9,
  reference,
  referenceColor = mc.mint,
  onSelect,
  selectedIndex = -1,
  style,
  duration = mm.sweep,
}: BarChartProps) {
  const reduced = useReducedMotion();
  const anims = useRef<Animated.Value[]>([]).current;

  const max = data.length ? Math.max(...data.map((d) => d.value), 0) : 0;
  const barW = data.length ? (width - gap * (data.length - 1)) / data.length : width;

  useEffect(() => {
    anims.length = data.length;
    data.forEach((_, i) => {
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
          duration,
          delay: 100 + i * 45,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [data.length, reduced, duration]);

  if (data.length === 0) return null;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        {reference !== undefined && max > 0 ? (
          <Line
            x1={0}
            y1={(1 - reference / max) * height}
            x2={width}
            y2={(1 - reference / max) * height}
            stroke={referenceColor}
            strokeWidth={1}
            strokeDasharray="4 5"
            opacity={0.6}
          />
        ) : null}
        {selectedIndex >= 0 && selectedIndex < data.length ? (
          <Line
            x1={selectedIndex * (barW + gap) + barW / 2}
            y1={0}
            x2={selectedIndex * (barW + gap) + barW / 2}
            y2={height}
            stroke={mc.textDim}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(2, (d.value / max) * (height - 2)) : 2;
          const a = anims[i];
          const fill = d.color ?? color;
          return (
            <AnimatedRect
              key={`${d.label ?? i}-${i}`}
              x={i * (barW + gap)}
              y={height}
              width={Math.max(2, barW)}
              height={a ? a.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) : h}
              rx={radius}
              fill={fill}
            />
          );
        })}
      </Svg>
      {onSelect ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {data.map((_, i) => (
            <Pressable
              key={i}
              style={[styles.slice, { width: barW + gap, left: i * (barW + gap) }]}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  slice: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
