/**
 * LoadingScreen — the Meridian launch screen.
 *
 * Background #0A0A0C. The mark is a red half-circle sun on a white horizon
 * with a white vertical meridian line and two grey reflection lines below.
 *
 * Sequence: meridian line draws top→bottom (0.7s) → horizon expands from
 * center (0.6s) → sun rises from behind the horizon (0.9s) → wordmark
 * "MERIDIAN" fades up, letter-spacing easing 16→7 (0.9s) → reflection lines
 * fade in → a looping 3dp red loader bar and "Getting things ready" until
 * the app is ready. Minimum display 1.8s. Respects reduce motion.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, Rect } from 'react-native-svg';

import { mc } from '../theme/meridian';
import useReducedMotion from './meridian/useReducedMotion';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedText = Animated.createAnimatedComponent(Text);

const HORIZON_Y = 92;
const MERIDIAN_TOP = 8;
const MERIDIAN_BOTTOM = 118;
const HORIZON_WIDTH = 172;
const SUN_CY_START = HORIZON_Y + 44;

export default function LoadingScreen() {
  const reduced = useReducedMotion();
  const [interactionsDone, setInteractionsDone] = useState(false);
  const [choreoDone, setChoreoDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [gone, setGone] = useState(false);

  const meridian = useRef(new Animated.Value(0)).current;
  const horizon = useRef(new Animated.Value(0)).current;
  const sun = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const reflection = useRef(new Animated.Value(0)).current;
  const loaderFade = useRef(new Animated.Value(0)).current;
  const overlayFade = useRef(new Animated.Value(1)).current;
  const loaderLoop = useRef(new Animated.Value(0)).current;

  // ─── Readiness gates: minimum display + first interactions settled ────
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setInteractionsDone(true));
    const minTimer = setTimeout(() => setMinElapsed(true), 1800);
    const choreoTimer = setTimeout(() => setChoreoDone(true), reduced ? 0 : 3120);
    return () => {
      task.cancel();
      clearTimeout(minTimer);
      clearTimeout(choreoTimer);
    };
  }, [reduced]);

  // ─── The choreography ─────────────────────────────────────────────────
  useEffect(() => {
    if (reduced) {
      meridian.setValue(1);
      horizon.setValue(1);
      sun.setValue(1);
      word.setValue(1);
      reflection.setValue(1);
      loaderFade.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(meridian, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG attribute — JS driver
      }),
      Animated.timing(horizon, {
        toValue: 1,
        duration: 600,
        delay: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG attribute — JS driver
      }),
      Animated.timing(sun, {
        toValue: 1,
        duration: 900,
        delay: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG attribute — JS driver
      }),
      Animated.timing(word, {
        toValue: 1,
        duration: 900,
        delay: 1850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // letterSpacing animates — no native driver
      }),
      Animated.timing(reflection, {
        toValue: 1,
        duration: 400,
        delay: 2450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG attribute — JS driver
      }),
      Animated.timing(loaderFade, {
        toValue: 1,
        duration: 300,
        delay: 2850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true, // plain RN view — native driver OK
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(loaderLoop, {
        toValue: 1,
        duration: 1150,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true, // plain RN view — native driver OK
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, meridian, horizon, sun, word, reflection, loaderFade, loaderLoop]);

  // ─── Fade out once ready, then unmount ────────────────────────────────
  useEffect(() => {
    if (!interactionsDone || !minElapsed || !choreoDone || fadingOut) return;
    setFadingOut(true);
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true, // plain RN view — native driver OK
    }).start(({ finished }) => {
      if (finished) setGone(true);
    });
  }, [interactionsDone, minElapsed, choreoDone, fadingOut, overlayFade]);

  if (gone) return null;

  const meridianY2 = meridian.interpolate({
    inputRange: [0, 1],
    outputRange: [MERIDIAN_TOP, MERIDIAN_BOTTOM],
  });
  const horizonWidth = horizon.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HORIZON_WIDTH],
  });
  const horizonX = horizon.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 100 - HORIZON_WIDTH / 2],
  });
  // The sun rises by changing only its center-Y (a numeric attribute).
  const sunCy = sun.interpolate({
    inputRange: [0, 1],
    outputRange: [SUN_CY_START, HORIZON_Y],
  });
  const wordOpacity = word.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const wordTranslateY = word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const wordSpacing = word.interpolate({ inputRange: [0, 1], outputRange: [16, 7] });
  const reflectionOpacity = reflection.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const loaderTranslateX = loaderLoop.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-52, 30, 112],
  });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayFade }]}
      pointerEvents={fadingOut ? 'none' : 'auto'}
      accessibilityLabel="Meridian — loading"
      accessibilityRole="progressbar"
    >
      {/* The mark */}
      <Svg width={200} height={160} viewBox="0 0 200 160">
        <Defs>
          <ClipPath id="aboveHorizon">
            <Rect x={0} y={0} width={200} height={HORIZON_Y} />
          </ClipPath>
        </Defs>

        {/* Sun — clipped to the region above the horizon so it rises from behind it */}
        <AnimatedCircle
          cx={100}
          cy={sunCy as any}
          r={32}
          fill={mc.red}
          clipPath="url(#aboveHorizon)"
        />

        {/* Meridian line draws top → bottom */}
        <AnimatedLine
          x1={100}
          y1={MERIDIAN_TOP}
          x2={100}
          y2={meridianY2 as any}
          stroke={mc.white}
          strokeWidth={2.4}
        />

        {/* Horizon expands from the center */}
        <AnimatedRect
          x={horizonX as any}
          y={HORIZON_Y - 1.25}
          width={horizonWidth as any}
          height={2.5}
          rx={1.25}
          fill={mc.white}
        />

        {/* Reflection lines fade in */}
        <AnimatedRect
          x={65}
          y={105}
          width={70}
          height={3}
          rx={1.5}
          fill="#55555C"
          opacity={reflectionOpacity as any}
        />
        <AnimatedRect
          x={78}
          y={115}
          width={44}
          height={3}
          rx={1.5}
          fill="#55555C"
          opacity={reflectionOpacity as any}
        />
      </Svg>

      {/* Wordmark */}
      <Animated.View style={[styles.wordWrap, { opacity: wordOpacity, transform: [{ translateY: wordTranslateY }] }]}>
        <AnimatedText style={[styles.wordmark, { letterSpacing: wordSpacing }]} allowFontScaling={false}>
          MERIDIAN
        </AnimatedText>
      </Animated.View>

      {/* Loader */}
      <Animated.View style={[styles.loaderWrap, { opacity: loaderFade }]}>
        <View style={styles.loaderTrack}>
          <Animated.View
            style={[
              styles.loaderBar,
              { transform: [{ translateX: loaderTranslateX }] },
            ]}
          />
        </View>
        <Text style={styles.loaderCaption}>Getting things ready</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 24,
  },
  wordWrap: {
    marginTop: 22,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '500',
    color: '#F2F2F4',
  },
  loaderWrap: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderTrack: {
    width: 120,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#26262C',
  },
  loaderBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EB0028',
  },
  loaderCaption: {
    fontSize: 12,
    color: '#8E8E96',
  },
});
