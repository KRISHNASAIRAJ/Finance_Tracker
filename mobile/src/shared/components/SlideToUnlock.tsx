/**
 * SlideToUnlock — iOS-style slide-to-unlock control used as the primary
 * "add transaction" action. A round thumb rides a pill track 1:1 with the
 * pointer (no transition while dragging) while a green fill grows behind it.
 * On release: past ~85% it latches open and fires onComplete; otherwise it
 * springs back with an overshooting spring (RN equivalent of
 * cubic-bezier(0.34, 1.56, 0.64, 1)).
 *
 * onComplete may return false (or a Promise resolving false) to signal that
 * the action failed — the control then resets itself to the start so the
 * user can try again.
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SlideToUnlockProps {
  onComplete: () => boolean | void | Promise<boolean | void>;
  label?: string;
  completeLabel?: string;
  height?: number;
  thumbSize?: number;
  fillColor?: string;
  disabled?: boolean;
}

export default function SlideToUnlock({
  onComplete,
  label = 'Slide to add',
  completeLabel = 'Added',
  height = 56,
  thumbSize = 46,
  fillColor = '#59D6C7',
  disabled = false,
}: SlideToUnlockProps) {
  const [trackW, setTrackW] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const unlockedRef = useRef(false);
  const [unlocked, setUnlocked] = useState(false);

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

  const fillWidth = translateX.interpolate({
    inputRange: [0, Math.max(maxX, 1)],
    outputRange: [0, trackW],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - trackW) > 1) setTrackW(w);
      }}
    >
      {/* Growing green fill behind the thumb */}
      <Animated.View
        style={[
          styles.fill,
          {
            width: fillWidth,
            backgroundColor: fillColor,
            borderRadius: height / 2,
          },
        ]}
      />

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>
        {unlocked ? completeLabel : label}
      </Text>

      {/* Thumb */}
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
        <View style={[styles.thumb, { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: unlocked ? fillColor : '#ffffff' }]}>
          <Ionicons
            name={unlocked ? 'checkmark' : 'arrow-forward'}
            size={22}
            color={unlocked ? '#0b1f1b' : '#3a4fc9'}
          />
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
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
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
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