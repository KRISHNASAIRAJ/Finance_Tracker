/**
 * ClockFace — the round clock dial.
 *
 * A black OnePlus dial with 60 minute ticks, the 12 numbers and two hands:
 * a white hour hand and a red minute hand. The value is set by dragging
 * (or tapping) the dial:
 *
 *   hours stage   → the 12 numbers, 30° apart
 *   minutes stage → the 60 ticks, 6° apart (1-minute precision)
 *
 * The centre shows the whole time — the unit being edited is red — with an
 * AM/PM pill under it. Tapping the time switches between the two stages.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { op } from '../theme/oneplus';
import {
  angleForHourHand,
  angleForHours,
  angleForMinutes,
  hours24From,
  hoursFromAngle,
  minutesFromAngle,
  nearestEquivalent,
  normalizeAngle,
  periodFrom24,
  type ClockMode,
  type ClockPeriod,
} from './clockMath';

interface ClockFaceProps {
  /** The hour in 24h. */
  hours24: number;
  /** The minute (0–59). */
  minute: number;
  /** Which unit is being edited. */
  mode: ClockMode;
  /** Called with the new hour (24h) / minute / period while dragging. */
  onChange: (next: { hours24?: number; minute?: number; period?: ClockPeriod }) => void;
  /** Called when the user wants to switch between the hours and the minutes. */
  onToggleMode: () => void;
  /** Called when the user flips the AM / PM pill. */
  onTogglePeriod: () => void;
  /** The dial size in dp. */
  size?: number;
}

const DEFAULT_SIZE = 264;

export default function ClockFace({
  hours24,
  minute,
  mode,
  onChange,
  onToggleMode,
  onTogglePeriod,
  size = DEFAULT_SIZE,
}: ClockFaceProps) {
  const radius = size / 2 - 10;
  const center = size / 2;

  const hour12 = ((hours24 % 12) + 12) % 12;
  const period: ClockPeriod = periodFrom24(hours24);

  // --- the hands (animated) ------------------------------------------------
  const hourAnim = useRef(new Animated.Value(angleForHours(hour12))).current;
  const minuteAnim = useRef(new Animated.Value(angleForMinutes(minute))).current;
  const hourRef = useRef(angleForHours(hour12));
  const minuteRef = useRef(angleForMinutes(minute));

  useEffect(() => {
    const targetHour = nearestEquivalent(angleForHourHand(hour12, minute), hourRef.current);
    hourRef.current = targetHour;
    Animated.timing(hourAnim, {
      toValue: targetHour,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const targetMinute = nearestEquivalent(angleForMinutes(minute), minuteRef.current);
    minuteRef.current = targetMinute;
    Animated.timing(minuteAnim, {
      toValue: targetMinute,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [hour12, minute, hourAnim, minuteAnim]);

  // --- the drag ------------------------------------------------------------
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dragged = useRef(false);

  const valueAt = useCallback(
    (x: number, y: number): { kind: 'hours'; hour12: number } | { kind: 'minutes'; minute: number } => {
      // The angle from the centre, 0 = up, clockwise.
      const dx = x - center;
      const dy = y - center;
      const deg = normalizeAngle((Math.atan2(dx, -dy) * 180) / Math.PI);
      if (modeRef.current === 'hours') return { kind: 'hours', hour12: hoursFromAngle(deg) };
      return { kind: 'minutes', minute: minutesFromAngle(deg) };
    },
    [center]
  );

  const applyAt = useCallback(
    (x: number, y: number) => {
      const v = valueAt(x, y);
      if (v.kind === 'hours') {
        const h24 = hours24From(v.hour12, period);
        onChange({ hours24: h24 });
      } else {
        onChange({ minute: v.minute });
      }
    },
    [valueAt, onChange, period]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim the touch once it turns into a drag — a tap on the
        // centre (the AM/PM pill) still works.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.hypot(g.dx, g.dy) > 4,
        onPanResponderGrant: (e) => {
          dragged.current = false;
          applyAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderMove: (e) => {
          dragged.current = true;
          applyAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderRelease: (e) => {
          if (!dragged.current) {
            // A plain tap on the dial sets the value under the finger.
            applyAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          }
        },
      }),
    [applyAt]
  );

  // --- the dial ------------------------------------------------------------
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; hour: boolean }[] = [];
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      const hour = i % 5 === 0;
      const outer = radius;
      const inner = radius - (hour ? 15 : 8);
      out.push({
        x1: center + Math.sin(a) * inner,
        y1: center - Math.cos(a) * inner,
        x2: center + Math.sin(a) * outer,
        y2: center - Math.cos(a) * outer,
        hour,
      });
    }
    return out;
  }, [radius, center]);

  const numbers = useMemo(() => {
    const out: { x: number; y: number; label: string }[] = [];
    for (let h = 0; h < 12; h++) {
      const a = (h * 30 * Math.PI) / 180;
      const r = radius - 34;
      out.push({
        x: center + Math.sin(a) * r,
        y: center - Math.cos(a) * r + 6,
        label: String(h === 0 ? 12 : h),
      });
    }
    return out;
  }, [radius, center]);

  const minuteLabel = String(minute).padStart(2, '0');
  const hourLabel = String(hour12 === 0 ? 12 : hour12);

  return (
    <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
      <Svg width={size} height={size}>
        {/* The face — a slightly darker disc on the red */}
        <Circle cx={center} cy={center} r={radius + 6} fill="rgba(0,0,0,0.18)" />

        {/* The minute ticks */}
        {ticks.map((t, i) => (
          <Line
            key={`t${i}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.hour ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'}
            strokeWidth={t.hour ? 2 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* The 12 numbers — the hours stage */}
        {mode === 'hours' &&
          numbers.map((n, i) => (
            <SvgText
              key={`n${i}`}
              x={n.x}
              y={n.y}
              fill={op.white}
              fontSize={17}
              fontWeight="600"
              textAnchor="middle"
            >
              {n.label}
            </SvgText>
          ))}
      </Svg>

      {/* The hour hand */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ rotate: hourAnim.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: center - 3,
            top: center - radius * 0.58,
            width: 6,
            height: radius * 0.58,
            borderRadius: 3,
            backgroundColor: op.white,
          }}
        />
      </Animated.View>

      {/* The minute hand */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ rotate: minuteAnim.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: center - 2,
            top: center - radius * 0.82,
            width: 4,
            height: radius * 0.82,
            borderRadius: 2,
            backgroundColor: op.red,
          }}
        />
      </Animated.View>

      {/* The centre cap */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: center - 5,
          top: center - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: op.red,
        }}
      />

      {/* The centre readout */}
      <Pressable style={styles.center} onPress={onToggleMode}>
        <Text style={styles.time}>
          <Text style={mode === 'hours' ? styles.unitActive : styles.unitIdle}>{hourLabel}</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={mode === 'minutes' ? styles.unitActive : styles.unitIdle}>{minuteLabel}</Text>
        </Text>
        <Pressable onPress={onTogglePeriod} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.period}>{period}</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
  },
  unitActive: {
    color: op.red,
  },
  unitIdle: {
    color: op.white,
  },
  colon: {
    color: op.white,
  },
  period: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: op.whiteDim,
  },
});
