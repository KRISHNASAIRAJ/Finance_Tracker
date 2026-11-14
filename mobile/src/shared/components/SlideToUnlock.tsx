/**
 * SlideToUnlock — iOS-style slide-to-unlock control used as the primary
 * "add transaction" action. A round knob rides a pill track 1:1 with the
 * pointer (no transition while dragging) while a tinted fill grows behind it.
 * On release: past ~85% it latches open, fires a haptic and calls onComplete;
 * otherwise it springs back with an overshooting spring.
 *
 * onComplete may return false (or a Promise resolving false) to signal that
 * the action failed — the control then resets itself to the start so the
 * user can try again.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { alpha } from '../theme/meridian';
import useReducedMotion from './meridian/useReducedMotion';

interface SlideToUnlockProps {
  onComplete: () => boolean | void | Promise<boolean | void>;
  label?: string;
  completeLabel?: string;
  height?: number;
  thumbSize?: number;
  fillColor?: string;
  /** Knob colour — defaults to fillColor. */
  knobColor?: string;
  /** Colour of the arrow glyph inside the knob. */
  knobIconColor?: string;
  disabled?: boolean;
}

export default function SlideToUnlock({
  onComplete,
  label = 'Slide to add',
  completeLabel = 'Added',
  height = 60,
  thumbSize = 50,
  fillColor = '#EB0028',
  knobColor,
  knobIconColor = '#FFFFFF',
  disabled = false,
}: SlideToUnlockProps) {
  const knob = knobColor ?? fillColor;
  const [trackW, setTrackW] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const unlockedRef = useRef(false);
  const [unlocked, setUnlocked] = useState(false);
  const reduced = useReducedMotion();
  const nudge = useRef(new Animated.Value(0)).current;
  const chevrons = useRef(new Animated.Value(0)).current;

  // Refs keep the latest props/geometry readable inside the (once-created)
  // PanResponder closure — otherwise it captures the very first render's
  // onComplete (empty amount) and track width (0).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const maxX = Math.max(0, trackW - thumbSize - 10);
  const maxXRef = useRef(maxX);
  maxXRef.current = maxX;

  const resetToStart = (animated = true) => {
    unlockedRef.current = false;
    setUnlocked(false);
    if (animated) {
      Animated.spring(translateX, {
        toValue: 0,
        friction: 7,
        tension: 70,
        useNativeDriver: false,
      }).start();
    } else {
      translateX.setValue(0);
    }
  };

  const handleRelease = (dx: number) => {
    if (unlockedRef.current) return;
    if (dx >= maxXRef.current * 0.85) {
      unlockedRef.current = true;
      setUnlocked(true);
      Vibration.vibrate(12); // haptic confirmation at the 85% threshold
      Animated.spring(translateX, {
        toValue: maxXRef.current,
        friction: 7,
        tension: 70,
        useNativeDriver: false,
      }).start(() => {
        const result = onCompleteRef.current();
        if (result && typeof (result as Promise<boolean | void>).then === 'function') {
          (result as Promise<boolean | void>).then((ok) => {
            if (ok === false) resetToStart();
          }).catch(() => resetToStart());
        } else if (result === false) {
          resetToStart();
        }
      });
    } else {
      resetToStart();
    }
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => !unlockedRef.current && !disabledRef.current,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        if (unlockedRef.current) return;
        translateX.setValue(Math.max(0, Math.min(maxXRef.current, g.dx)));
      },
      onPanResponderRelease: (_e, g) => handleRelease(g.dx),
      onPanResponderTerminate: () => {
        if (!unlockedRef.current) resetToStart();
      },
    })
  ).current;

  // Idle affordances: knob arrow nudges, chevrons at the far edge pulse
  useEffect(() => {
    if (reduced || unlocked) return;
    const nudgeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 900, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    const chevLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevrons, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(chevrons, { toValue: 0, duration: 700, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.delay(350),
      ])
    );
    nudgeLoop.start();
    chevLoop.start();
    return () => {
      nudgeLoop.stop();
      chevLoop.stop();
    };
  }, [reduced, unlocked, nudge, chevrons]);

  const fillWidth = translateX.interpolate({
    inputRange: [0, Math.max(maxX, 1)],
    outputRange: [0, trackW],
    extrapolate: 'clamp',
  });
  const chevronsOpacity = chevrons.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const nudgeX = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - trackW) > 1) setTrackW(w);
      }}
    >
      {/* Growing tinted fill behind the knob */}
      <Animated.View
        style={[
          styles.fill,
          {
            width: fillWidth,
            backgroundColor: alpha(fillColor, 0.16),
            borderRadius: height / 2,
          },
        ]}
      />

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>
        {unlocked ? completeLabel : label}
      </Text>

      {/* Chevrons at the far edge, pulsing */}
      <Animated.View style={[styles.chevrons, { opacity: chevronsOpacity }]} pointerEvents="none">
        <Ionicons name="chevron-forward" size={17} color="#55555C" style={styles.chevronOverlap} />
        <Ionicons name="chevron-forward" size={17} color="#55555C" />
      </Animated.View>

      {/* Knob */}
      <Animated.View
        style={[
          styles.thumbWrap,
          {
            width: thumbSize + 10,
            height,
            transform: [{ translateX }],
          },
        ]}
        {...pan.panHandlers}
      >
        <View style={[styles.thumb, { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: unlocked ? fillColor : knob }]}>
          <Animated.View style={{ transform: [{ translateX: nudgeX }] }}>
            <Ionicons
              name={unlocked ? 'checkmark' : 'arrow-forward'}
              size={22}
              color={knobIconColor}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131316',
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#C8C8CE',
    letterSpacing: 0.4,
  },
  chevrons: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronOverlap: {
    marginRight: -9,
  },
  thumbWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    justifyContent: 'center',
    paddingLeft: 5,
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
