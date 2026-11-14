/**
 * TopBar — the Meridian screen header.
 *
 * Two shapes:
 *   'left'  → back button + title on the left (detail screens)
 *   'center'→ back | title | action, title centred (detail screens with an
 *              action button on the right)
 *   'large' → a big screen title + an optional right slot (tab roots)
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../theme/meridian';
import PressScale from './PressScale';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** A node on the right (an icon button, an avatar…). */
  right?: React.ReactNode;
  /** 'center' keeps the title centred between back and action. */
  variant?: 'left' | 'center';
  /** Use the big 26px screen title instead of the 19px sub-title. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function TopBar({
  title,
  subtitle,
  onBack,
  right,
  variant = 'center',
  large = false,
  style,
}: TopBarProps) {
  const back = onBack ? (
    <PressScale
      onPress={onBack}
      scale={0.92}
      accessibilityLabel="Go back"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.circle}
    >
      <Ionicons name="arrow-back" size={19} color={mc.text} />
    </PressScale>
  ) : null;

  const titleBlock = (
    <View style={variant === 'center' ? styles.titleCenter : styles.titleLeft}>
      {title ? (
        <Text style={large ? styles.large : styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.bar, style]}>
      {back}
      {titleBlock}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    height: 58,
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
  },
  titleLeft: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  large: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  subtitle: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 1,
  },
  right: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
});
