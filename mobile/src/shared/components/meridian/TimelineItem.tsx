/**
 * TimelineItem — a row on a vertical timeline.
 *
 * A coloured dot on a 2px rail with the content card beside it. The last
 * item drops the rail so the timeline ends cleanly.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { mc } from '../../theme/meridian';

interface TimelineItemProps {
  children: React.ReactNode;
  /** The dot colour. */
  color?: string;
  /** Hide the rail below this item. */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function TimelineItem({ children, color = mc.amber, last, style }: TimelineItemProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.railCol}>
        <View style={[styles.rail, !last && styles.railOn]} />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 12,
  },
  railCol: {
    width: 14,
    alignItems: 'center',
  },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'transparent',
  },
  railOn: {
    backgroundColor: mc.track,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 12,
    borderWidth: 3,
    borderColor: mc.canvas,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
});
