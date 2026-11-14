/**
 * SegmentedControl — a sliding pill over a row of options.
 *
 * The pill slides to the selected option (0.25s cross-fade feel) and the
 * active label turns white on the accent.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { mc, mm, mr } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

export interface SegmentOption {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
  /** The active pill colour. */
  accent?: string;
  /** Text colour of the active option. */
  activeText?: string;
  style?: object;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  accent = mc.red,
  activeText = mc.white,
  style,
}: SegmentedControlProps) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const anim = useRef(new Animated.Value(index)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      anim.setValue(index);
      return;
    }
    Animated.timing(anim, {
      toValue: index,
      duration: mm.crossfade,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, anim, reduced]);

  const segWidth = width > 0 ? (width - 8) / options.length : 0;

  return (
    <View style={[styles.wrap, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segWidth > 0 ? (
        <Animated.View
          style={[
            styles.pill,
            {
              width: segWidth,
              backgroundColor: accent,
              transform: [
                { translateX: anim.interpolate({ inputRange: options.map((_, i) => i), outputRange: options.map((_, i) => i * segWidth) }) },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <View key={o.key} style={styles.seg}>
            <Text
              onPress={() => onChange(o.key)}
              numberOfLines={1}
              style={[styles.label, active && { color: activeText, fontWeight: '600' }]}
            >
              {o.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: mc.card,
    borderRadius: mr.chip,
    padding: 4,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: mr.chip - 4,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
  label: {
    fontSize: 14,
    color: mc.textDim,
  },
});
