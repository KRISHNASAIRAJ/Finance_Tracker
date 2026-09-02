/**
 * ExpenseConfirmationScreen — post-add confirmation for a transaction that
 * prints out like a thermal receipt: the paper emerges from a printer slot
 * top-to-bottom, the print head rides down the paper, then a stamp slams on.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type RoutePropType = RouteProp<FinanceStackParamList, 'ExpenseConfirmation'>;
type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'ExpenseConfirmation'>;

const PAPER = '#f2efe9';
const PAPER_INK = '#17171c';

export default function ExpenseConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { transactionId } = route.params;

  const { transactions } = useFinanceStore();
  const tx = transactions.find((t) => t.id === transactionId);

  const [paperHeight, setPaperHeight] = useState(0);
  const printProgress = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(0)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (paperHeight <= 0 || hasAnimated.current) return;
    hasAnimated.current = true;
    printProgress.setValue(0);
    stampScale.setValue(0);
    stampOpacity.setValue(0);
    ctaAnim.setValue(0);

    Animated.timing(printProgress, {
      toValue: 1,
      duration: 1800,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      Animated.sequence([
        Animated.timing(stampOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(stampScale, {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.timing(ctaAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [paperHeight, printProgress, stampScale, stampOpacity, ctaAnim]);

  const printedHeight = printProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, paperHeight],
  });
  const printHeadTop = printProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [2, paperHeight - 2],
  });

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  const methodLabel = (() => {
    const raw = (tx as any)?.paymentMode || '';
    if (!raw) return 'Cash / Auto';
    const parts = String(raw).split(':');
    return parts.length > 1 && parts[1] ? `${parts[0].toUpperCase()} · ${parts[1]}` : parts[0].toUpperCase();
  })();

  const dateLabel = tx
    ? new Date(tx.date).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Printer */}
        <View style={styles.printer}>
          {/* Printer housing — paper comes out of the slot below */}
          <View style={styles.printerTop}>
            <View style={styles.printerBrand}>
              <View style={styles.printerLed} />
              <Text style={styles.printerBrandText}>RECEIPT PRINTER</Text>
            </View>
            <View style={styles.slot} />
          </View>

          <View style={styles.paperStage}>
            {/* Print head that rides down the paper */}
            <Animated.View style={[styles.printHead, { top: printHeadTop }]}>
              <View style={styles.printHeadLine} />
              <View style={styles.printHeadDot} />
            </Animated.View>

            {/* Paper revealed so far (clipped at top) */}
            <Animated.View style={[styles.paperClip, { height: printedHeight }]}>
              {tx ? (
                <View
                  style={styles.paper}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (Math.abs(h - paperHeight) > 1) setPaperHeight(h);
                  }}
                >
                  <View style={styles.paperTopRow}>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.paperTiny}>PAYMENT RECEIPT</Text>
                    <View style={{ flex: 1 }} />
                  </View>

                  <View style={styles.dashes} />
                  <View style={styles.paperAmtRow}>
                    <Text style={[styles.paperAmtLabel, { color: PAPER_INK }]}>AMOUNT</Text>
                    <Animated.View
                      style={[
                        styles.stampInline,
                        {
                          opacity: stampOpacity,
                          transform: [{ scale: stampScale.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }],
                        },
                      ]}
                    >
                      <Ionicons name="checkmark" size={10} color={colors.success} />
                      <Text style={styles.stampText}>LOGGED</Text>
                    </Animated.View>
                  </View>
                  <Text style={[styles.paperAmt, { color: PAPER_INK }]}>{formatCurrency(tx.amount)}</Text>

                  <View style={styles.paperRow}>
                    <Text style={styles.paperRowLabel}>DESCRIPTION</Text>
                    <Text style={[styles.paperRowValue, { color: PAPER_INK }]} numberOfLines={2}>
                      {tx.notes || tx.category}
                    </Text>
                  </View>

                  <View style={styles.paperRow}>
                    <Text style={styles.paperRowLabel}>CATEGORY</Text>
                    <View style={styles.paperBadge}>
                      <Text style={styles.paperBadgeText}>{tx.category.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.paperRow}>
                    <Text style={styles.paperRowLabel}>METHOD</Text>
                    <Text style={[styles.paperRowValue, { color: PAPER_INK }]}>{methodLabel}</Text>
                  </View>

                  <View style={styles.paperRow}>
                    <Text style={styles.paperRowLabel}>DATE & TIME</Text>
                    <Text style={[styles.paperRowValue, { color: PAPER_INK }]}>{dateLabel}</Text>
                  </View>

                  <View style={styles.dashes} />
                  <Text style={[styles.paperTxn, { color: PAPER_INK }]}>TXN #{tx.id.toUpperCase()}</Text>

                  {/* Perforation notches */}
                  <View style={styles.notchLeft} />
                  <View style={styles.notchRight} />
                </View>
              ) : null}
            </Animated.View>
          </View>
        </View>

        {/* CTA */}
        <Animated.View
          style={{ opacity: ctaAnim, transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
        >
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('MonthlySpend')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward" size={18} color={colors.textPrimary} />
            <Text style={styles.doneText}>Back to Spends</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.containerPadding,
    gap: 18,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  subheading: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: -14,
  },
  printer: {
    width: '100%',
    maxWidth: 340,
  },
  printerTop: {
    backgroundColor: '#232329',
    borderTopLeftRadius: rounded.lg,
    borderTopRightRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  printerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  printerLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  printerBrandText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
  },
  slot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  paperStage: {
    position: 'relative',
    minHeight: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomLeftRadius: rounded.lg,
    borderBottomRightRadius: rounded.lg,
    overflow: 'hidden',
  },
  paperClip: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  paper: {
    width: '100%',
    backgroundColor: PAPER,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 8,
    position: 'relative',
  },
  paperTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperTiny: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(23,23,28,0.55)',
    textAlign: 'center',
  },
  dashes: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(23,23,28,0.4)',
    marginVertical: 4,
  },
  paperAmtLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.6,
  },
  paperAmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  paperAmt: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  paperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 2,
  },
  paperRowLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(23,23,28,0.55)',
    marginTop: 2,
    width: 92,
  },
  paperRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  paperBadge: {
    backgroundColor: '#17171c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paperBadgeText: {
    color: PAPER,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  paperTxn: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.55,
    textAlign: 'center',
  },
  notchLeft: {
    position: 'absolute',
    left: -6,
    bottom: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  notchRight: {
    position: 'absolute',
    right: -6,
    bottom: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  printHead: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
    height: 4,
  },
  printHeadLine: {
    height: 2,
    backgroundColor: '#ff5a5f',
    opacity: 0.9,
    shadowColor: '#ff5a5f',
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  printHeadDot: {
    position: 'absolute',
    right: 8,
    top: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff5a5f',
  },
  stampInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  stampText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.DEFAULT,
  },
  doneText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
