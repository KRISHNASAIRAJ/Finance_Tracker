import React, { useEffect, useRef, useId } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, G } from 'react-native-svg';

type SizeVariant = 'sm' | 'default' | 'md' | 'lg';
type SpeedVariant = 'slow' | 'normal' | 'fast';

const sizeMap: Record<SizeVariant, number> = {
  sm: 16,
  default: 20,
  md: 24,
  lg: 32,
};

const speedMap: Record<SpeedVariant, number> = {
  slow: 2000,
  normal: 1000,
  fast: 500,
};

interface SpinnerProps {
  size?: SizeVariant;
  speed?: SpeedVariant;
  color?: string;
}

export default function Spinner({
  size = 'md',
  speed = 'normal',
  color = '#9BA5FF',
}: SpinnerProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const id = useId();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: speedMap[speed],
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue, speed]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const svgSize = sizeMap[size];

  return (
    <Animated.View style={[styles.wrapper, { width: svgSize, height: svgSize }, { transform: [{ rotate }] }]}>
      <Svg width={svgSize} height={svgSize} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient
            id={`s1-${id}`}
            x1="50%"
            x2="50%"
            y1="5.271%"
            y2="91.793%"
          >
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </LinearGradient>
          <LinearGradient
            id={`s2-${id}`}
            x1="50%"
            x2="50%"
            y1="15.24%"
            y2="87.15%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={0} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <G fill="none">
          <Path
            d="M8.749.021a1.5 1.5 0 0 1 .497 2.958A7.5 7.5 0 0 0 3 10.375a7.5 7.5 0 0 0 7.5 7.5v3c-5.799 0-10.5-4.7-10.5-10.5C0 5.23 3.726.865 8.749.021"
            fill={`url(#s1-${id})`}
            transform="translate(1.5 1.625)"
          />
          <Path
            d="M15.392 2.673a1.5 1.5 0 0 1 2.119-.115A10.48 10.48 0 0 1 21 10.375c0 5.8-4.701 10.5-10.5 10.5v-3a7.5 7.5 0 0 0 5.007-13.084a1.5 1.5 0 0 1-.115-2.118"
            fill={`url(#s2-${id})`}
            transform="translate(1.5 1.625)"
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
