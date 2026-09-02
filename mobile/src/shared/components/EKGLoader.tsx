/**
 * EKGLoader — a heart-rate monitor loading animation. A faint EKG wave
 * (flat → QRS spike → flat → small bump → flat) with a glowing dot that
 * sweeps along the trace in a 2.4s infinite loop.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface EKGLoaderProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Build a small EKG path shape. */
function ekgPath(w: number, h: number): string {
  const m = 0.12 * w; // margins
  const innerW = w - 2 * m;
  const mid = h / 2;
  const amp = 0.35 * h; // spike amplitude
  const bump = 0.12 * h; // small bump
  return [
    `M ${m} ${mid}`,
    `L ${m + 0.22 * innerW} ${mid}`,               // flat
    `L ${m + 0.30 * innerW} ${mid - amp}`,          // QRS up
    `L ${m + 0.38 * innerW} ${mid + amp * 0.4}`,    // QRS down
    `L ${m + 0.44 * innerW} ${mid - bump}`,         // QRS up small
    `L ${m + 0.50 * innerW} ${mid}`,                // back to flat
    `L ${m + 0.70 * innerW} ${mid}`,                // flat
    `L ${m + 0.78 * innerW} ${mid - bump * 0.8}`,   // small bump up
    `L ${m + 0.85 * innerW} ${mid + bump * 0.3}`,   // small bump down
    `L ${m + 0.92 * innerW} ${mid}`,                // back to flat
    `L ${w - m} ${mid}`,                            // flat end
  ].join(' ');
}

export default function EKGLoader({ size = 120, color = '#59D6C7', strokeWidth = 2 }: EKGLoaderProps) {
  const svgW = size;
  const svgH = size * 0.5;
  const pathRef = useRef<any>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [dotPos, setDotPos] = React.useState({ x: 0, y: 0 });

  const pathD = ekgPath(svgW, svgH);

  // Animate the dot along the path
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // Update dot position from path progress
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      if (pathRef.current) {
        try {
          const totalLen = pathRef.current.getTotalLength();
          const pt = pathRef.current.getPointAtLength(value * totalLen);
          setDotPos({ x: pt.x, y: pt.y });
        } catch {
          // path not ready yet
        }
      }
    });
    return () => progress.removeListener(id);
  }, [progress]);

  return (
    <View style={[styles.wrap, { width: size, height: svgH + 8 }]}>
      <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Faint EKG trace */}
        <Path
          ref={pathRef}
          d={pathD}
          stroke={`${color}50`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Glowing dot — positioned absolutely over the SVG */}
      {dotPos.x > 0 && (
        <View
          style={[
            styles.dot,
            {
              left: dotPos.x - 5,
              top: dotPos.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
});