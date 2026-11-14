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

import { mc } from '../theme/meridian';
import { useDrawerStore } from '../useDrawerStore';

export default function DrawerTrigger() {
  const toggle = useDrawerStore((s) => s.toggle);
  return (
    <TouchableOpacity
      style={styles.trigger}
      activeOpacity={0.7}
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Open menu"
    >
      <Ionicons name="menu" size={19} color={mc.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
});
