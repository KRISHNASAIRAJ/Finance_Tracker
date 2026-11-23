/** Undo toast for a swiped-to-delete note. Uses only Meridian motion tokens. */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, mm } from '../../../shared/theme/meridian';
import useReducedMotion from '../../../shared/components/meridian/useReducedMotion';
import PressScale from '../../../shared/components/meridian/PressScale';

interface Props {
  message: string;
  onUndo: () => void;
  onDone: () => void;
  durationMs?: number;
}

export default function UndoToast({ message, onUndo, onDone, durationMs = 4000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
    } else {
      Animated.timing(opacity, { toValue: 1, duration: mm.crossfade, useNativeDriver: true }).start();
    }
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [opacity, onDone, durationMs, reduced]);

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.message} numberOfLines={1}>{message}</Text>
      <PressScale onPress={onUndo} scale={0.94} accessibilityLabel="Undo delete">
        <Text style={styles.undo}>Undo</Text>
      </PressScale>
      <Ionicons name="checkmark-circle" size={16} color={mc.mint} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.cardAlt,
    borderRadius: mr.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mc.line,
  },
  message: { flex: 1, fontSize: 13, color: mc.text },
  undo: { fontSize: 13, fontWeight: '600', color: mc.amber },
});
