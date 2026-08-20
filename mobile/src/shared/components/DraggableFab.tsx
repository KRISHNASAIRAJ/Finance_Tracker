/**
 * DraggableFab — floating action button that can be dragged anywhere on screen.
 * Position is clamped to the safe area and persisted per-screen via AsyncStorage.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DraggableFabProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  storageKey: string;
  onPress: () => void;
}

const FAB_SIZE = 56;
const EDGE_PADDING = 16;
const BOTTOM_PADDING = 96;

export default function DraggableFab({ icon, color, size = 24, storageKey, onPress }: DraggableFabProps) {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const initialX = screenW - FAB_SIZE - EDGE_PADDING;
  const initialY = screenH - FAB_SIZE - BOTTOM_PADDING;

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const positionRef = useRef({ x: initialX, y: initialY });
  const pressedRef = useRef(false);
  const savedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!mounted || !raw) return;
        const pos = JSON.parse(raw) as { x: number; y: number };
        const maxX = screenW - FAB_SIZE - EDGE_PADDING;
        const maxY = screenH - FAB_SIZE - BOTTOM_PADDING;
        positionRef.current = {
          x: Math.min(Math.max(pos.x, EDGE_PADDING), maxX),
          y: Math.min(Math.max(pos.y, EDGE_PADDING), maxY),
        };
        pan.setValue(positionRef.current);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [storageKey, pan, screenW, screenH]);

  const persistPosition = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    AsyncStorage.setItem(storageKey, JSON.stringify(positionRef.current)).catch(() => {});
    setTimeout(() => { savedRef.current = false; }, 300);
  }, [storageKey]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pressedRef.current = true;
        pan.stopAnimation();
      },
      onPanResponderMove: (_evt, gesture) => {
        const maxX = screenW - FAB_SIZE - EDGE_PADDING;
        const maxY = screenH - FAB_SIZE - BOTTOM_PADDING;
        const x = Math.min(Math.max(initialX + gesture.dx, EDGE_PADDING), maxX);
        const y = Math.min(Math.max(initialY + gesture.dy, EDGE_PADDING), maxY);
        positionRef.current = { x, y };
        pan.setValue({ x, y });
      },
      onPanResponderRelease: () => {
        pressedRef.current = false;
        persistPosition();
      },
      onPanResponderTerminate: () => {
        pressedRef.current = false;
        persistPosition();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.wrapper, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => { if (!pressedRef.current) onPress(); }}
      >
        <Ionicons name={icon} size={size} color={color} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
