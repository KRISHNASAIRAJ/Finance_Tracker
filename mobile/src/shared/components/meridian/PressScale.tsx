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
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import useReducedMotion from './useReducedMotion';

interface PressScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
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
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
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
