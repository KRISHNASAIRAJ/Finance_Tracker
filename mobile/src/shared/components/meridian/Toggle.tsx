/**
 * Toggle — the Meridian switch.
 *
 * 44x26 pill; the knob slides right when on. The accent defaults to violet,
 * which is the reference design's colour for a switch.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { mc, mm } from '../../theme/meridian';
import useReducedMotion from './useReducedMotion';

interface ToggleProps {
  value: boolean;
  onChange?: (next: boolean) => void;
  accent?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const W = 44;
const H = 26;
const KNOB = 20;

export default function Toggle({
  value,
  onChange,
  accent = mc.violet,
  disabled,
  accessibilityLabel,
}: ToggleProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: mm.crossfade,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, anim, reduced]);

  return (
    <View
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      onTouchEnd={() => {
        if (!disabled && onChange) onChange(!value);
      }}
      style={[styles.track, { backgroundColor: value ? accent : mc.track }, disabled && { opacity: 0.5 }]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            transform: [
              { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [3, W - KNOB - 3] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: W,
    height: H,
    borderRadius: H / 2,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: mc.white,
  },
});
