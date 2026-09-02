/**
 * SoftScrollView — React Native equivalent of SwiftUI's
 * `.scrollEdgeEffectStyle(.soft, for: .all)`.
 *
 * SwiftUI's `.hard` edge effect shears/clips content sharply when it reaches
 * the top edge under the nav bar; `.soft` blurs it smoothly. React Native's
 * UIScrollView has no such API, so the closest equivalents are:
 *  - Android: `overScrollMode="never"` removes the hard overscroll edge glow
 *  - iOS: `contentInsetAdjustmentBehavior="never"` + disabled scroll-indicator
 *    auto-inset so the system never shifts/slices content under bars (our
 *    screens already pad via SafeAreaView, so no content underlaps).
 * Apply this once per scroll surface; it propagates to everything inside.
 */
import React from 'react';
import {
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

interface SoftScrollViewProps extends ScrollViewProps {
  /** Extra bottom padding so content clears the tab/nav bar. */
  bottomInset?: number;
}

export default function SoftScrollView({
  children,
  bottomInset = 0,
  style,
  contentContainerStyle,
  ...rest
}: SoftScrollViewProps) {
  return (
    <ScrollView
      // Android: no harsh overscroll edge glow (the "hard" edge effect)
      overScrollMode="never"
      // iOS: keep content from being auto-inset/sliced under system bars
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustsScrollIndicatorInsets={false}
      style={style}
      contentContainerStyle={[
        contentContainerStyle,
        bottomInset ? { paddingBottom: bottomInset } : null,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
