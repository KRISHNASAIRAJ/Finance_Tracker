/**
 * ListRow — one line inside a card.
 *
 * A leading badge, a title, an optional subtitle and a right-hand value.
 * Rows stack with a 1px divider between them, exactly like the reference.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { mc } from '../../theme/meridian';
import PressScale from './PressScale';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** The right-hand value. */
  value?: string;
  /** The small caption under the right-hand value. */
  valueCaption?: string;
  /** Colour of the right-hand value. */
  valueColor?: string;
  /** A leading element (an IconTile, an avatar, a dot). */
  leading?: React.ReactNode;
  /** A trailing element (a chevron, an icon button). */
  trailing?: React.ReactNode;
  /** Draw the divider above this row. */
  divider?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ListRow({
  title,
  subtitle,
  value,
  valueCaption,
  valueColor,
  leading,
  trailing,
  divider = true,
  onPress,
  style,
}: ListRowProps) {
  const body = (
    <View style={[styles.row, divider && styles.divider, style]}>
      {leading}
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value !== undefined || valueCaption !== undefined ? (
        <View style={styles.right}>
          {value !== undefined ? (
            <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {valueCaption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {valueCaption}
            </Text>
          ) : null}
        </View>
      ) : null}
      {trailing}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressScale onPress={onPress} scale={0.985} style={styles.press}>
      {body}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  press: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    color: mc.text,
  },
  subtitle: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  caption: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
});
