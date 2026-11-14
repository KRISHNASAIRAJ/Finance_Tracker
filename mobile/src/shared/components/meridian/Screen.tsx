/**
 * Screen — the page frame every reskinned screen uses.
 *
 * One canvas, the Android status-bar inset handled once, and a scroll view
 * with the Meridian gutters.
 */
import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { mc } from '../../theme/meridian';

interface ScreenProps {
  children: React.ReactNode;
  /** Render a ScrollView (default) or a plain View. */
  scroll?: boolean;
  /** Bottom padding — leave room for the floating tab bar. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Forwarded to the ScrollView. */
  onScroll?: any;
  scrollEventThrottle?: number;
}

export default function Screen({
  children,
  scroll = true,
  bottomInset = 110,
  contentStyle,
  style,
  onScroll,
  scrollEventThrottle = 16,
}: ScreenProps) {
  const pad = {
    paddingHorizontal: 18,
    paddingBottom: bottomInset,
    gap: 10,
  };

  if (!scroll) {
    return (
      <View style={[styles.root, style]}>
        <View style={[styles.body, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, pad, contentStyle]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mc.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  flex: { flex: 1 },
  content: {
    paddingTop: 4,
  },
  body: {
    flex: 1,
  },
});
