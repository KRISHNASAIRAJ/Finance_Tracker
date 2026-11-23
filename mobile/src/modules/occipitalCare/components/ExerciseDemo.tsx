/**
 * ExerciseDemo — a small looping animated figure that demonstrates each
 * daily care movement. Built from core `Animated` + plain Views (no new native
 * dependency), honours the OS reduce-motion setting, and every loop is
 * under 1.6s per the Meridian motion rules.
 *
 * This is a gentle visual aid, not medical instruction — follow the written
 * steps and stop if anything causes sharp pain.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { mc, mr } from '../../../shared/theme/meridian';
import useReducedMotion from '../../../shared/components/meridian/useReducedMotion';
import type { ExerciseMotion } from '../careData';

interface ExerciseDemoProps {
  motion: ExerciseMotion;
  playing?: boolean;
  size?: number;
}

const STAGE_HEIGHT = 96;

/** Interpolate 0..1 into a neutral → peak → neutral curve. */
function pulse(drive: Animated.Value, peak: number, base = 0): Animated.AnimatedInterpolation<number> {
  return drive.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [base, peak, base],
    easing: Easing.inOut(Easing.sin),
  });
}

export default function ExerciseDemo({ motion, playing = true, size = 132 }: ExerciseDemoProps) {
  const reduced = useReducedMotion();
  const drive = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing || reduced) {
      // Static mid-frame when paused, or the neutral/peak frame when reduced.
      drive.setValue(reduced ? 0.5 : 0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drive, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [playing, reduced, drive]);

  const center = size / 2;
  const headShiftX = pulse(drive, motion === 'chinTuck' ? -12 : motion === 'turn' ? 4 : 0);
  const headRotate = motion === 'tilt'
    ? drive.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['0deg', '16deg', '0deg'],
        easing: Easing.inOut(Easing.sin),
      })
    : drive.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0deg'] });
  const headScaleX = motion === 'turn'
    ? pulse(drive, 0.72, 1)
    : drive.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const shoulderLift = pulse(drive, motion === 'shoulder' ? -6 : 0);
  const shoulderWidth = motion === 'shoulder'
    ? pulse(drive, 1.07, 1)
    : drive.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const ringScale = motion === 'breathe'
    ? pulse(drive, 1.16, 0.86)
    : drive.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const ringOpacity = motion === 'breathe'
    ? pulse(drive, 0.85, 0.25)
    : drive.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

  return (
    <View style={[styles.stage, { width: size, height: STAGE_HEIGHT }]} accessibilityLabel={`${motion} demonstration`}>
      <View style={[styles.ground, { left: 8, right: 8 }]} />

      {/* breathing / heat aura */}
      {motion === 'breathe' || motion === 'heat' ? (
        <Animated.View
          style={[
            styles.ring,
            {
              left: center - 33,
              top: 0,
              opacity: motion === 'breathe' ? ringOpacity : 0.55,
              transform: [{ scale: motion === 'breathe' ? ringScale : 1 }],
            },
          ]}
        />
      ) : null}

      {/* shoulders */}
      <Animated.View
        style={[
          styles.shoulders,
          {
            left: center - 48,
            transform: [{ translateY: shoulderLift }, { scaleX: shoulderWidth }],
          },
        ]}
      />

      {/* neck */}
      <View style={[styles.neck, { left: center - 8 }]} />

      {/* head */}
      <Animated.View
        style={[
          styles.head,
          {
            left: center - 22,
            transform: [
              { translateX: headShiftX },
              { rotate: headRotate },
              { scaleX: headScaleX },
            ],
          },
        ]}
      >
        <View style={styles.face} />
      </Animated.View>

      {/* heat waves */}
      {motion === 'heat' ? (
        <>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.wave,
                {
                  left: center - 30 - i * 4,
                  top: 2 + i * 11,
                  opacity: pulse(drive, 0.85, 0.15),
                },
              ]}
            />
          ))}
        </>
      ) : null}

      <View style={styles.badge}>
        <Text style={styles.badgeText}>DEMO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: mr.row,
    backgroundColor: mc.raised,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  ground: {
    position: 'absolute',
    bottom: 14,
    height: 1,
    backgroundColor: mc.lineSoft,
  },
  shoulders: {
    position: 'absolute',
    bottom: 15,
    width: 96,
    height: 18,
    borderRadius: 10,
    backgroundColor: mc.violetDim,
    borderWidth: 1,
    borderColor: mc.violet,
  },
  neck: {
    position: 'absolute',
    bottom: 31,
    width: 16,
    height: 22,
    borderRadius: 6,
    backgroundColor: mc.track,
  },
  head: {
    position: 'absolute',
    bottom: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mc.chip,
    borderWidth: 1.5,
    borderColor: mc.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: mc.textDim,
  },
  ring: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: mc.mint,
    top: -6,
  },
  wave: {
    position: 'absolute',
    width: 60,
    height: 8,
    borderRadius: 8,
    borderTopWidth: 2,
    borderColor: mc.amber,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: mc.canvas,
  },
  badgeText: {
    fontSize: 8,
    letterSpacing: 1,
    color: mc.textFaint,
    fontWeight: '600',
  },
});
