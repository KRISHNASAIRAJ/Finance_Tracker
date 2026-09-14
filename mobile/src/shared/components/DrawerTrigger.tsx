/**
 * DrawerTrigger — per-screen hamburger trigger for the global drawer.
 * Rendered by each tab dashboard itself, so visibility is 100%
 * deterministic: if the screen is on screen, the trigger is visible.
 * (Replaces the old global trigger whose visibility depended on
 * navigation-state listener timing on cold start.)
 */
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useDrawerStore } from '../useDrawerStore';

export default function DrawerTrigger() {
  const toggle = useDrawerStore((s) => s.toggle);
  return (
    <TouchableOpacity
      style={styles.trigger}
      activeOpacity={0.7}
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <LinearGradient colors={['#8b95ff', '#5ee6ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
        <Ionicons name="menu" size={18} color="#0A0A10" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,149,255,0.35)',
    backgroundColor: 'rgba(16, 16, 22, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
    shadowColor: '#7b8eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  grad: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
