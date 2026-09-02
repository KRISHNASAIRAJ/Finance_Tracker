/**
 * SyncReconcile — local-first data reconciliation animation.
 * Two compact value chips approach from opposite sides, pause while a bridge
 * scans between them, then dissolve into one authoritative SYNCED value.
 * Designed to read as calm data resolution rather than a generic success state.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SyncReconcileProps {
  /** Called when the animation finishes one full cycle. */
  onComplete?: () => void;
  /** Label for the authoritative synced state. */
  syncedLabel?: string;
  /** Chip labels for the two sides. */
  leftLabel?: string;
  rightLabel?: string;
}

export default function SyncReconcile({
  onComplete,
  syncedLabel = 'SYNCED',
  leftLabel = 'LOCAL',
  rightLabel = 'CLOUD',
}: SyncReconcileProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // Track phases via listener
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      if (value >= 0.98) onComplete?.();
    });
    return () => progress.removeListener(id);
  }, [progress, onComplete]);

  // — approach phase 0–0.3 —
  const leftX = progress.interpolate({
    inputRange: [0, 0.3],
    outputRange: [-80, 0],
    extrapolate: 'clamp',
  });
  const rightX = progress.interpolate({
    inputRange: [0, 0.3],
    outputRange: [80, 0],
    extrapolate: 'clamp',
  });

  // — scan phase 0.3–0.7 —
  const bridgeOpacity = progress.interpolate({
    inputRange: [0.3, 0.4, 0.6, 0.7],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const scannerX = progress.interpolate({
    inputRange: [0.3, 0.7],
    outputRange: [-40, 40],
    extrapolate: 'clamp',
  });

  // — synced phase 0.7–1.0 —
  const chipOpacity = progress.interpolate({
    inputRange: [0.65, 0.75],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const syncedOpacity = progress.interpolate({
    inputRange: [0.7, 0.8],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const syncedScale = progress.interpolate({
    inputRange: [0.7, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });

  const chipStyle = {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(89,214,199,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(89,214,199,0.4)',
  };
  const chipText = {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    color: '#59D6C7',
  };

  return (
    <View style={styles.stage}>
      {/* Approaching chips */}
      <Animated.View style={[styles.chip, chipStyle, { opacity: chipOpacity, transform: [{ translateX: leftX }], position: 'absolute' }]}>
        <Text style={chipText}>{leftLabel}</Text>
      </Animated.View>
      <Animated.View style={[styles.chip, chipStyle, { opacity: chipOpacity, transform: [{ translateX: rightX }], position: 'absolute' }]}>
        <Text style={chipText}>{rightLabel}</Text>
      </Animated.View>

      {/* Scanning bridge between them */}
      <Animated.View style={[styles.bridge, { opacity: bridgeOpacity }]}>
        <Animated.View style={[styles.scanner, { transform: [{ translateX: scannerX }] }]}>
          <Ionicons name="sync-outline" size={12} color="#59D6C7" />
        </Animated.View>
      </Animated.View>

      {/* Final authoritative SYNCED value */}
      <Animated.View
        style={[
          styles.syncedChip,
          {
            opacity: syncedOpacity,
            transform: [{ scale: syncedScale }],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={12} color="#59D6C7" />
        <Text style={[chipText, { color: '#59D6C7' }]}>{syncedLabel}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 120,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bridge: {
    position: 'absolute',
    width: 80,
    height: 2,
    backgroundColor: 'rgba(89,214,199,0.25)',
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanner: {
    position: 'absolute',
    top: -5,
    width: 20,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(89,214,199,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(89,214,199,0.5)',
  },
});