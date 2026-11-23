/**
 * SwipeableNoteRow — swipe right to pin, swipe left to move to Recently Deleted.
 * Built with React Native's PanResponder + Reanimated-free Animated so no new
 * dependency is introduced. Reduced-motion users get the same end state with
 * no slide animation.
 */
import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import useReducedMotion from '../../../shared/components/meridian/useReducedMotion';

const THRESHOLD = 72;

interface Props {
  pinned: boolean;
  onPin: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export default function SwipeableNoteRow({ pinned, onPin, onDelete, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const settle = () => {
    if (reduced) {
      translateX.setValue(0);
      return;
    }
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 18,
    }).start();
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderMove: (_e, gesture) => {
        if (reduced) return;
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_e, gesture) => {
        if (gesture.dx > THRESHOLD) {
          onPin();
        } else if (gesture.dx < -THRESHOLD) {
          onDelete();
        }
        settle();
      },
      onPanResponderTerminate: settle,
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={[styles.actionLayer, styles.pinSide]}>
        <Ionicons name={pinned ? 'pin-outline' : 'pin'} size={20} color={mc.amber} />
      </View>
      <View style={[styles.actionLayer, styles.deleteSide]}>
        <Ionicons name="trash-outline" size={20} color={mc.redSoft} />
      </View>
      <Animated.View {...responder.panHandlers} style={[styles.foreground, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden', borderRadius: mr.card },
  actionLayer: {
    position: 'absolute', top: 0, bottom: 0, width: 84,
    alignItems: 'center', justifyContent: 'center', borderRadius: mr.card,
  },
  pinSide: { left: 0, backgroundColor: mc.amberDim },
  deleteSide: { right: 0, backgroundColor: mc.redDim },
  foreground: { backgroundColor: mc.card, borderRadius: mr.card },
});
