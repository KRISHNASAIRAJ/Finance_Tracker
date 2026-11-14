/**
 * CountUp — a number that counts up to its value in 0.8s.
 *
 * Used for the big money and score readouts. Honours reduced motion by
 * jumping straight to the final value.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

interface CountUpProps {
  value: number;
  /** Formats the value for display. */
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  children?: (formatted: string) => React.ReactNode;
}

export default function CountUp({
  value,
  format,
  duration = mm.count,
  style,
  children,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const anim = useRef(new Animated.Value(reduced ? value : 0)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(value);
      setShown(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => {
      const next = Math.round(v * 100) / 100;
      setShown((prev) => (Math.abs(prev - next) >= 0.01 ? next : prev));
    });
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim, duration, reduced]);

  const text = format ? format(shown) : String(shown);

  if (children) {
    return <>{children(text)}</>;
  }

  return <Text style={[styles.text, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '500',
  },
});
