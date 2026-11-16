/**
 * Shared Reanimated motion primitives.
 *
 * Everything here is UI-only and seek-safe: a spring/timing entrance that
 * runs once on mount, a staggered list item, and a pressable spring. All of
 * them honour the OS "reduce motion" setting and fall back to a plain View.
 */
import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Shared motion tokens — keep durations short and consistent. */
export const motion = {
  enterDuration: 260,
  staggerStep: 55,
  travel: 16,
  spring: { damping: 20, stiffness: 260, mass: 0.6 },
} as const;

interface EnterProps {
  children: React.ReactNode;
  /** Stagger position (0 = first). */
  index?: number;
  /** Skip the animation (e.g. for a screen that already animates itself). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One-shot fade + lift on mount. */
export function ScreenEnter({ children, index = 0, disabled = false, style }: EnterProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || disabled) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      Math.min(index, 8) * motion.staggerStep,
      withTiming(1, {
        duration: motion.enterDuration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [progress, index, reduced, disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: (1 - progress.value) * (reduced || disabled ? 0 : motion.travel),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.fill, animatedStyle, style]}>{children}</Animated.View>
  );
}

/** Springy press feedback for cards and chips. */
export function SpringPress({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[style, animatedStyle]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onTouchStart={() => {
        if (!reduced) scale.value = withSpring(0.96, motion.spring);
      }}
      onTouchEnd={() => {
        scale.value = withSpring(1, motion.spring);
        onPress?.();
      }}
      onTouchCancel={() => {
        scale.value = withSpring(1, motion.spring);
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default ScreenEnter;
