/**
 * PressScale — a touchable that scales to 0.97 while pressed.
 *
 * The reference design's press feedback. Uses core Animated only.
 */
import React, { useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import useReducedMotion from './useReducedMotion';

interface PressScaleProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  /** Long-press handler (the habit rows use it to enter edit mode). */
  onLongPress?: (event: GestureResponderEvent) => void;
  /** Delay before a long-press is recognised. */
  delayLongPress?: number;
  /** Layout styles for the outer Pressable (flex, width, margins). */
  wrapStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** How far it shrinks while held. */
  scale?: number;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'checkbox' | 'radio' | 'switch' | 'tab' | 'image' | 'text';
  testID?: string;
}

export default function PressScale({
  children,
  onPress,
  onLongPress,
  delayLongPress,
  wrapStyle,
  style,
  disabled,
  scale = 0.97,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
}: PressScaleProps) {
  const anim = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const to = (v: number) => {
    if (reduced) return;
    Animated.timing(anim, {
      toValue: v,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
      style={wrapStyle}
    >
      <Animated.View style={[styles.base, { transform: [{ scale: anim }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'transparent' },
});
