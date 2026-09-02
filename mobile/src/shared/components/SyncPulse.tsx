/**
 * SyncPulse — a reconcile/authority pulse for sync-related UI.
 * Mirrors the CSS:
 *   .sources span  { animation: reconcile-in 3.4s var(--spring) infinite; }
 *   .reconcile strong { animation: authority-in 3.4s var(--spring) infinite; }
 *   @keyframes authority-in {
 *     0%, 42% { opacity: 0; transform: scale(.82); }
 *     58%, 84% { opacity: 1; transform: scale(1); }
 *   }
 * Runs a 3.4s infinite loop: hidden → pop in → hold → repeat, with a spring
 * overshoot on the appear step.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

interface SyncPulseProps {
  children: React.ReactNode;
  /** When false the pulse is static (fully visible). */
  active?: boolean;
  /** Animate the inner content (icon) instead of the wrapper. */
  inner?: boolean;
}

export default function SyncPulse({ children, active = true, inner = false }: SyncPulseProps) {
  const progress = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        // 0% → 42%: hidden, scaled down
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 1428, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.82, duration: 1428, easing: Easing.linear, useNativeDriver: true }),
        ]),
        // 42% → 58%: pop in with a spring overshoot
        Animated.parallel([
          Animated.spring(opacity, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
        ]),
        // 58% → 84%: hold visible
        Animated.timing(progress, {
          toValue: 0,
          duration: 884,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, progress, scale, opacity]);

  const animStyle = {
    opacity,
    transform: [{ scale }],
  };

  return (
    <Animated.View style={[styles.wrap, inner ? undefined : animStyle]}>
      {inner ? <Animated.View style={animStyle}>{children}</Animated.View> : children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});