/**
 * Screen — the page frame every reskinned screen uses.
 *
 * One canvas, the Android status-bar inset handled once, and a scroll view
 * with the Meridian gutters.
 */
import React, { forwardRef } from 'react';
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
  /** Overlay layer rendered above the scroll content (e.g. a FAB). */
  floating?: React.ReactNode;
}

const Screen = forwardRef<ScrollView | null, ScreenProps>(function Screen(
  {
    children,
    scroll = true,
    bottomInset = 110,
    contentStyle,
    style,
    onScroll,
    scrollEventThrottle = 16,
    floating,
  }: ScreenProps,
  ref
) {
  const pad = {
    paddingHorizontal: 18,
    paddingBottom: bottomInset,
    gap: 10,
  };

  if (!scroll) {
    return (
      <View style={[styles.root, style]}>
        <View style={[styles.body, contentStyle]}>{children}</View>
        {floating}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <ScrollView
        ref={ref as any}
        style={styles.flex}
        contentContainerStyle={[styles.content, pad, contentStyle]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {children}
      </ScrollView>
      {floating}
    </View>
  );
});

export default Screen;

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
