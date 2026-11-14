/**
 * ExpenseConfirmationScreen — post-add receipt shown as a thermal print:
 * the paper emerges from the printer slot top-to-bottom in stepped frames
 * while the printer jitters, the LED turns mint when the receipt is ready,
 * a LOGGED stamp slams on at −3°, then the CTA buttons slide up.
 * All values come from the saved transaction — never hardcoded.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Polygon, Rect } from 'react-native-svg';

import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import useReducedMotion from '../../../shared/components/meridian/useReducedMotion';

type RoutePropType = RouteProp<FinanceStackParamList, 'ExpenseConfirmation'>;
type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'ExpenseConfirmation'>;

const BG = '#0A0A0C';
const PAPER = '#F0EDE6';
const PAPER_INK = '#1A1A1D';
const PAPER_LABEL = '#6E6A60';
const PAPER_DASH = '#B8B3A6';
const STAMP = '#1E9E72';
const RED = '#EB0028';
const MINT = '#3EE6B0';
const AMBER = '#FFB547';
const BODY = '#131316';

const STEPS = 26;
const STEP_MS = 100; // 26 steps × 100ms = 2.6s of printing
const PRINT_DELAY_MS = 400;
const STAMP_DELAY_AFTER_PRINT_MS = 0; // stamp lands right when printing completes (t≈3.0s)
const CTA_DELAY_MS = 300; // buttons slide up at t≈3.3s

export default function ExpenseConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { transactionId } = route.params;

  const { transactions } = useFinanceStore();
  const tx = transactions.find((t) => t.id === transactionId);
  const reduced = useReducedMotion();

  const [paperHeight, setPaperHeight] = useState(0);
  const [step, setStep] = useState(reduced ? STEPS : 0);
  const [ready, setReady] = useState(reduced);
  const [replayKey, setReplayKey] = useState(0);

  const jitter = useRef(new Animated.Value(0)).current;
  const ledBlink = useRef(new Animated.Value(1)).current;
  const stampScale = useRef(new Animated.Value(reduced ? 1 : 1.8)).current;
  const stampOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const ctaAnim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  // Print choreography — stepped reveal via 26 discrete steps (with a haptic
  // tick each), then the stamp slams on, then the CTAs slide up.
  useEffect(() => {
    if (reduced) {
      setStep(STEPS);
      setReady(true);
      stampScale.setValue(1);
      stampOpacity.setValue(1);
      ctaAnim.setValue(1);
      return;
    }
    setStep(0);
    setReady(false);
    stampScale.setValue(1.8);
    stampOpacity.setValue(0);
    ctaAnim.setValue(0);

    let interval: ReturnType<typeof setInterval> | null = null;
    let stampTimer: ReturnType<typeof setTimeout> | null = null;
    let ctaTimer: ReturnType<typeof setTimeout> | null = null;

    const startTimer = setTimeout(() => {
      let s = 0;
      interval = setInterval(() => {
        s += 1;
        setStep(s);
        Vibration.vibrate(8); // tick per stepped frame
        if (s >= STEPS) {
          if (interval) clearInterval(interval);
          stampTimer = setTimeout(() => {
            setReady(true);
            Vibration.vibrate(30); // firm tap as the stamp lands
            Animated.timing(stampOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }).start();
            Animated.spring(stampScale, {
              toValue: 1,
              friction: 5,
              tension: 190,
              useNativeDriver: true,
            }).start();
            ctaTimer = setTimeout(() => {
              Animated.timing(ctaAnim, {
                toValue: 1,
                duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start();
            }, CTA_DELAY_MS);
          }, STAMP_DELAY_AFTER_PRINT_MS);
        }
      }, STEP_MS);
    }, PRINT_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
      if (stampTimer) clearTimeout(stampTimer);
      if (ctaTimer) clearTimeout(ctaTimer);
    };
  }, [replayKey, reduced, stampScale, stampOpacity, ctaAnim]);

  // Printer jitter — 0.7px sideways shudder while the paper is coming out.
  useEffect(() => {
    if (reduced || ready) {
      jitter.stopAnimation();
      jitter.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jitter, { toValue: 0.7, duration: 30, useNativeDriver: true }),
        Animated.timing(jitter, { toValue: 0, duration: 30, useNativeDriver: true }),
        Animated.delay(60),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ready, replayKey, reduced, jitter]);

  // LED blink while printing — amber, then steady mint once ready.
  useEffect(() => {
    if (reduced || ready) {
      ledBlink.stopAnimation();
      ledBlink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ledBlink, { toValue: 0.25, duration: 250, useNativeDriver: true }),
        Animated.timing(ledBlink, { toValue: 1, duration: 250, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ready, replayKey, reduced, ledBlink]);

  const revealH = paperHeight > 0 ? (step / STEPS) * paperHeight : 0;

  const amountBody = tx
    ? (tx.amount / 100).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : '0.00';

  const methodLabel = (() => {
    const raw = (tx as any)?.paymentMode || '';
    if (!raw) return 'Cash / Auto';
    const parts = String(raw).split(':');
    return parts.length > 1 && parts[1] ? `${parts[0].toUpperCase()} · ${parts[1]}` : parts[0].toUpperCase();
  })();

  const dateLabel = tx
    ? `${new Date(tx.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}, ${new Date(tx.date)
        .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        .toLowerCase()}`
    : '';

  const txnShort = tx ? tx.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() : '';

  const handleBackToSpends = () => {
    // Atomic stack reset: AddExpense was `replace`d by this screen, so
    // a plain navigate() to MonthlySpend pushes a NEW Spends screen on
    // top of this receipt — then every back-press replays the receipt.
    // Resetting [FinanceHome, MonthlySpend] destroys the receipt for good.
    navigation.reset({
      index: 1,
      routes: [{ name: 'FinanceHome' }, { name: 'MonthlySpend' }],
    });
  };

  const handleAddAnother = () => {
    navigation.reset({
      index: 1,
      routes: [{ name: 'FinanceHome' }, { name: 'AddExpense' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Stage — printer pinned top, paper grows from the slot */}
      <View style={styles.stage}>
        <Pressable
          onPress={() => setReplayKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel="Print the receipt again"
        >
          <Animated.View style={[styles.printer, { transform: [{ translateX: jitter }] }]}>
            {/* Printer body */}
            <View style={styles.body}>
              <View style={styles.topRow}>
                <Animated.View
                  style={[styles.led, { opacity: ledBlink, backgroundColor: ready ? MINT : AMBER }]}
                />
                <Text style={styles.topLabel}>{ready ? 'RECEIPT READY' : 'PRINTING'}</Text>
              </View>
              <View style={styles.slot} />
            </View>

            {/* Paper — clipped from height 0 to full, revealing top-down */}
            <View style={styles.paperClip}>
              <View style={{ height: revealH, overflow: 'hidden' }}>
                <View
                  style={styles.paper}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (Math.abs(h - paperHeight) > 1) setPaperHeight(h);
                  }}
                >
                  {/* PAYMENT RECEIPT title */}
                  <Text style={styles.title}>PAYMENT RECEIPT</Text>
                  <View style={[styles.dashes, { marginTop: 12, marginBottom: 0 }]} />

                  {/* AMOUNT + LOGGED stamp */}
                  <View style={styles.amountRow}>
                    <Text style={styles.label}>AMOUNT</Text>
                    <Animated.View
                      style={[
                        styles.stamp,
                        {
                          opacity: stampOpacity,
                          transform: [{ scale: stampScale }, { rotate: '-3deg' }],
                        },
                      ]}
                    >
                      <Ionicons name="checkmark" size={11} color={STAMP} />
                      <Text style={styles.stampText}>LOGGED</Text>
                    </Animated.View>
                  </View>
                  <Text style={styles.amount}>
                    <Text style={styles.amountRupee}>₹</Text>
                    {amountBody}
                  </Text>

                  {/* DESCRIPTION */}
                  <View style={styles.row}>
                    <Text style={styles.label}>DESCRIPTION</Text>
                    <Text style={styles.rowValue} numberOfLines={2}>
                      {tx ? tx.notes || tx.category : ''}
                    </Text>
                  </View>

                  {/* CATEGORY chip */}
                  <View style={styles.row}>
                    <Text style={styles.label}>CATEGORY</Text>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{tx ? tx.category.toUpperCase() : ''}</Text>
                    </View>
                  </View>

                  {/* METHOD */}
                  <View style={styles.row}>
                    <Text style={styles.label}>METHOD</Text>
                    <Text style={styles.rowValue}>{methodLabel}</Text>
                  </View>

                  {/* DATE AND TIME */}
                  <View style={styles.row}>
                    <Text style={styles.label}>DATE AND TIME</Text>
                    <Text style={styles.rowValue}>{dateLabel}</Text>
                  </View>

                  {/* Dashed divider with side notches */}
                  <View style={styles.perf}>
                    <View style={[styles.notch, styles.notchLeft]} />
                    <View style={[styles.notch, styles.notchRight]} />
                    <View style={[styles.dashes, { marginTop: 16 }]} />
                  </View>

                  {/* TXN id */}
                  <Text style={styles.txn}>TXN #{txnShort}</Text>

                  {/* Barcode */}
                  <Svg
                    width="100%"
                    height={30}
                    viewBox="0 0 220 30"
                    preserveAspectRatio="none"
                    style={styles.barcode}
                  >
                    <G fill={PAPER_INK}>
                      <Rect x="0" width="3" height="30" />
                      <Rect x="6" width="1.5" height="30" />
                      <Rect x="10" width="4" height="30" />
                      <Rect x="17" width="1.5" height="30" />
                      <Rect x="21" width="3" height="30" />
                      <Rect x="28" width="1.5" height="30" />
                      <Rect x="32" width="5" height="30" />
                      <Rect x="40" width="2" height="30" />
                      <Rect x="45" width="1.5" height="30" />
                      <Rect x="49" width="4" height="30" />
                      <Rect x="56" width="2" height="30" />
                      <Rect x="61" width="3" height="30" />
                      <Rect x="67" width="1.5" height="30" />
                      <Rect x="71" width="5" height="30" />
                      <Rect x="79" width="2" height="30" />
                      <Rect x="84" width="1.5" height="30" />
                      <Rect x="88" width="4" height="30" />
                      <Rect x="95" width="3" height="30" />
                      <Rect x="101" width="1.5" height="30" />
                      <Rect x="105" width="2" height="30" />
                      <Rect x="110" width="5" height="30" />
                      <Rect x="118" width="1.5" height="30" />
                      <Rect x="122" width="3" height="30" />
                      <Rect x="128" width="2" height="30" />
                      <Rect x="133" width="4" height="30" />
                      <Rect x="140" width="1.5" height="30" />
                      <Rect x="144" width="3" height="30" />
                      <Rect x="150" width="5" height="30" />
                      <Rect x="158" width="2" height="30" />
                      <Rect x="163" width="1.5" height="30" />
                      <Rect x="167" width="4" height="30" />
                      <Rect x="174" width="2" height="30" />
                      <Rect x="179" width="3" height="30" />
                      <Rect x="185" width="1.5" height="30" />
                      <Rect x="189" width="5" height="30" />
                      <Rect x="197" width="2" height="30" />
                      <Rect x="202" width="3" height="30" />
                      <Rect x="208" width="1.5" height="30" />
                      <Rect x="212" width="4" height="30" />
                    </G>
                  </Svg>
                </View>
              </View>

              {/* Zigzag torn edge */}
              <View style={{ height: revealH >= paperHeight - 1 ? 10 : 0, overflow: 'hidden' }}>
                <Svg width="100%" height={10} viewBox="0 0 300 10" preserveAspectRatio="none">
                  <Polygon
                    fill={PAPER}
                    points="0,0 300,0 290,10 280,0 270,10 260,0 250,10 240,0 230,10 220,0 210,10 200,0 190,10 180,0 170,10 160,0 150,10 140,0 130,10 120,0 110,10 100,0 90,10 80,0 70,10 60,0 50,10 40,0 30,10 20,0 10,10 0,0"
                  />
                </Svg>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* Actions — slide up at t≈3.3s */}
      <Animated.View
        style={[
          styles.actions,
          {
            opacity: ctaAnim,
            transform: [
              { translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToSpends}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Back to spends"
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back to spends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAddAnother}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add another transaction"
        >
          <Text style={styles.addAnother}>Add another</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 30,
    overflow: 'hidden',
  },
  printer: {
    width: '100%',
    maxWidth: 340,
  },
  body: {
    backgroundColor: BODY,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    height: 66,
  },
  topRow: {
    position: 'relative',
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  led: {
    position: 'absolute',
    left: '50%',
    marginLeft: -92,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  topLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
    color: '#8E8E96',
  },
  slot: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
    marginTop: 14,
  },
  paperClip: {
    marginHorizontal: 14,
    overflow: 'hidden',
  },
  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '500',
    color: PAPER_LABEL,
  },
  dashes: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PAPER_DASH,
    marginTop: 14,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '500',
    color: PAPER_LABEL,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: STAMP,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stampText: {
    color: STAMP,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  amount: {
    fontSize: 46,
    fontWeight: '500',
    letterSpacing: -1,
    color: PAPER_INK,
    marginTop: 6,
    marginBottom: 4,
  },
  amountRupee: {
    color: RED,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 13,
    gap: 12,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '500',
    color: PAPER_INK,
  },
  chip: {
    backgroundColor: PAPER_INK,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    color: PAPER,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
  },
  perf: {
    position: 'relative',
    marginHorizontal: -20, // bleed to the sheet edges so the notches straddle them
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BG,
    zIndex: 2,
  },
  notchLeft: {
    left: -9,
  },
  notchRight: {
    right: -9,
  },
  txn: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
    color: PAPER_LABEL,
    marginTop: 14,
  },
  barcode: {
    marginTop: 10,
  },
  actions: {
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'android' ? 18 : 30,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RED,
    borderRadius: 24,
    paddingVertical: 15,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  addAnother: {
    textAlign: 'center',
    color: '#8E8E96',
    fontSize: 14,
    fontWeight: '500',
    paddingTop: 12,
    paddingBottom: 2,
  },
});
