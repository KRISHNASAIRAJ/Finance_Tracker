/**
 * LineChart — a soft trend line that draws itself in 1.6s.
 *
 * Optionally fills the area under the line and can draw a dashed reference
 * line (the average / target).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { mc, mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';
import { estimateLength, smoothPath, toPoints, type Point } from './chartMath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface LineChartProps {
  data: number[];
  width: number;
  height?: number;
  color?: string;
  /** Fill the area under the line with a soft gradient. */
  area?: boolean;
  /** A dashed horizontal reference line at this value. */
  reference?: number;
  referenceColor?: string;
  referenceLabel?: string;
  /** Draw a dot on the last point. */
  endDot?: boolean;
  paddingTop?: number;
  paddingBottom?: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
}

export default function LineChart({
  data,
  width,
  height = 90,
  color = mc.red,
  area = false,
  reference,
  referenceColor = mc.sky,
  referenceLabel,
  endDot = false,
  paddingTop = 8,
  paddingBottom = 8,
  style,
  duration = mm.draw,
  delay = 200,
}: LineChartProps) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const pathRef = useRef<any>(null);
  const [len, setLen] = useState(0);

  const points: Point[] = useMemo(
    () => toPoints(data, width, height, paddingTop, paddingBottom),
    [data, width, height, paddingTop, paddingBottom]
  );

  const path = useMemo(() => smoothPath(points), [points]);

  const areaPath = useMemo(() => {
    if (!area || points.length === 0) return '';
    const base = height - paddingBottom;
    return `${path} L${round(points[points.length - 1].x)},${round(base)} L${round(points[0].x)},${round(base)} Z`;
  }, [area, path, points, height, paddingBottom]);

  // Measure the real path length when the platform can, otherwise estimate it.
  useEffect(() => {
    const measured = pathRef.current?.getTotalLength?.();
    setLen(typeof measured === 'number' && measured > 0 ? measured : estimateLength(points));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, points.length]);

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, duration, delay, reduced, path]);

  const min = data.length ? Math.min(...data) : 0;
  const max = data.length ? Math.max(...data) : 0;
  const innerH = Math.max(1, height - paddingTop - paddingBottom);
  const refY =
    reference !== undefined
      ? paddingTop + innerH - ((reference - min) / ((max - min) || 1)) * innerH
      : null;

  const gradientId = `ln${Math.abs(hashCode(color))}`;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        {area ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.18" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
        ) : null}

        {refY !== null ? (
          <Line
            x1={0}
            y1={refY}
            x2={width}
            y2={refY}
            stroke={referenceColor}
            strokeWidth={1}
            strokeDasharray="4 5"
            opacity={0.6}
          />
        ) : null}

        {area && areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}

        {points.length > 1 ? (
          <AnimatedPath
            ref={pathRef}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={anim.interpolate({
              inputRange: [0, 1],
              outputRange: [len, 0],
            })}
          />
        ) : null}

        {endDot && points.length > 0 ? (
          <Circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={5}
            fill={color}
          />
        ) : null}
      </Svg>

      {referenceLabel && refY !== null ? (
        <Text style={[styles.refText, { color: referenceColor, top: Math.max(0, refY - 15) }]}>
          {referenceLabel}
        </Text>
      ) : null}
    </View>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

const styles = StyleSheet.create({
  refText: {
    position: 'absolute',
    right: 0,
    fontSize: 11,
    fontWeight: '600',
  },
});
