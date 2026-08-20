import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
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
  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card
      style={[styles.card, { borderColor: `${color}30` }, style]}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
    >
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
    padding: ts.cardPadding,
    position: 'relative',
  },
  content: {
    alignItems: 'flex-start',
    gap: 6,
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
