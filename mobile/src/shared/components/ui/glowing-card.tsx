import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tc, ts, tr, dataLarge, labelMuted } from '../../theme/tracend';

interface GlowingCardProps {
  value: string;
  label: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export type { GlowingCardProps };

export default function GlowingCard({
  value,
  label,
  subtitle,
  icon,
  color = tc.action,
  onPress,
  style,
}: GlowingCardProps) {
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const glowAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (dims.width <= 0 || dims.height <= 0) return;

    const duration = 5000;

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: duration / 4,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: duration / 4,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.75,
          duration: duration / 4,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: duration / 4,
          useNativeDriver: true,
        }),
      ]),
    );
    animRef.current.start();

    return () => {
      animRef.current?.stop();
    };
  }, [dims.width, dims.height]);

  useEffect(() => {
    return () => {
      animRef.current?.stop();
    };
  }, []);

  const haloSize = 40;

  const haloX = glowAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [dims.width - haloSize / 2, -haloSize / 2, -haloSize / 2, dims.width - haloSize / 2, dims.width - haloSize / 2],
    extrapolate: 'clamp',
  });

  const haloY = glowAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-haloSize / 2, -haloSize / 2, dims.height - haloSize / 2, dims.height - haloSize / 2, -haloSize / 2],
    extrapolate: 'clamp',
  });

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card
      style={[styles.card, style]}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDims({ width, height });
      }}
    >
      <View style={styles.borderOverlay} pointerEvents="none">
        {dims.width > 0 && (
          <Animated.View
            style={[
              styles.halo,
              {
                width: haloSize,
                height: haloSize,
                backgroundColor: color,
                transform: [
                  { translateX: haloX },
                  { translateY: haloY },
                ],
              },
            ]}
          />
        )}
      </View>

      <View style={styles.content}>
        {icon && (
          <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
        )}
        <Text style={[dataLarge, { color: tc.textPrimary }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={labelMuted}>{label}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tc.surfaceContainer,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
    overflow: 'hidden',
    padding: ts.cardPadding,
    position: 'relative',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  halo: {
    position: 'absolute',
    borderRadius: 20,
    opacity: 0.25,
  },
  content: {
    alignItems: 'flex-start',
    gap: 6,
    zIndex: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: tr.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: tc.textMuted,
    marginTop: 2,
  },
});
