/**
 * MainHomeScreen — primary Home tab: daily quote, habit progress bar,
 * sleep info, AI finance commentary, stress-release techniques, and an
 * auto-rotating growth-principles carousel.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { tc } from '../../../shared/theme/tracend';
import GlassCard from '../../../shared/components/GlassCard';
import Entrance from '../../../shared/components/Entrance';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import { quoteForDate, stressTechniquesForDate, PRINCIPLES } from '../../../shared/dailyContent';
import { HABITS, todayKey, dayProgress, progressBlocks, habitStreak } from '../../habits/habits';
import { useHabitStore, habitsForDay } from '../../habits/store';
import { useSleepStore, sleepDurationHours, formatSleepDuration } from '../../sleep/store';
import { useFinanceStore } from '../../finance/store';
import { useAuth } from '../../../services/AuthProvider';
import { supabase } from '../../../services/supabaseClient';
import { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FinanceComment {
  comment: string;
  fetchedAt: number;
}

const PRINCIPLE_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'flash-outline', 'ban-outline', 'cube-outline', 'flag-outline', 'trending-up-outline', 'hardware-chip-outline',
];

export default function MainHomeScreen() {
  const navigation = useNavigation<Nav>();
  const days = useHabitStore((s) => s.days);
  const sleepEntries = useSleepStore((s) => s.entries);
  const { user } = useAuth();
  const transactions = useFinanceStore((s) => s.transactions);

  const today = todayKey();
  const ticked = habitsForDay(days, today);
  const progress = dayProgress(ticked);
  const pct = Math.round(progress * 100);

  const streaks = HABITS.map((h) => ({
    ...h,
    streak: habitStreak(h.key, (k) => habitsForDay(days, k)),
  }));
  const bestStreak = streaks.reduce((m, s) => Math.max(m, s.streak), 0);

  const quote = quoteForDate();
  const techniques = stressTechniquesForDate();

  // ---- Sleep info ----
  const sleepInfo = useMemo(() => {
    const sorted = [...sleepEntries].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    const last = sorted[0] ?? null;
    const last7 = sorted.slice(0, 7);
    const avg = last7.length > 0
      ? last7.reduce((s, e) => s + sleepDurationHours(e), 0) / last7.length
      : null;
    return { last, avg, count: sorted.length };
  }, [sleepEntries]);

  // ---- AI finance commentary ----
  const [financeComment, setFinanceComment] = useState<FinanceComment | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

  const buildFinanceContext = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const spendTypes = new Set(['expense', 'fuel_purchase', 'vehicle_service']);
    const monthTxns = transactions.filter((t: any) => spendTypes.has(t.type) && String(t.date).slice(0, 7) === monthKey);
    const prevTxns = transactions.filter((t: any) => spendTypes.has(t.type) && String(t.date).slice(0, 7) === prev);

    const byCat = new Map<string, { amount: number; count: number }>();
    for (const t of monthTxns) {
      const cat = t.category || 'Other';
      const cur = byCat.get(cat) ?? { amount: 0, count: 0 };
      cur.amount += t.amount / 100;
      cur.count += 1;
      byCat.set(cat, cur);
    }
    const categories = [...byCat.entries()]
      .map(([category, v]) => ({ category, amountRupees: Math.round(v.amount), count: v.count }))
      .sort((a, b) => b.amountRupees - a.amountRupees);

    const byDay = new Map<string, number>();
    for (const t of monthTxns) {
      const d = String(t.date).slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + t.amount / 100);
    }
    let topDay: { date: string; amountRupees: number } | null = null;
    for (const [date, amount] of byDay) {
      if (!topDay || amount > topDay.amountRupees) topDay = { date, amountRupees: Math.round(amount) };
    }

    const biggest = monthTxns.reduce<{ category: string; amountRupees: number; note?: string } | null>((m, t: any) => {
      const amt = t.amount / 100;
      return !m || amt > m.amountRupees
        ? { category: t.category || 'Other', amountRupees: Math.round(amt), note: t.notes || undefined }
        : m;
    }, null);

    return {
      monthLabel: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      totalSpendRupees: Math.round(monthTxns.reduce((s: number, t: any) => s + t.amount / 100, 0)),
      budgetRupees: null,
      topDay,
      biggestTx: biggest,
      lastMonthTotalRupees: prevTxns.length > 0
        ? Math.round(prevTxns.reduce((s: number, t: any) => s + t.amount / 100, 0))
        : null,
      categories: categories.slice(0, 8),
    };
  };

  const fetchFinanceComment = async (force = false) => {
    if (financeLoading) return;
    const cached = (financeCommentRef as unknown as { current: FinanceComment | null }).current;
    if (!force && cached && Date.now() - cached.fetchedAt < 6 * 3600 * 1000) return;
    setFinanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-finance-comment', {
        body: { context: buildFinanceContext() },
      });
      if (!error && data?.comment) {
        (financeCommentRef as unknown as { current: FinanceComment | null }).current = {
          comment: data.comment as string,
          fetchedAt: Date.now(),
        };
        setFinanceComment({ comment: data.comment as string, fetchedAt: Date.now() });
      }
    } catch {
      /* offline-friendly: keep last comment */
    } finally {
      setFinanceLoading(false);
    }
  };

  // Module-level-ish cache via ref held outside render cycle
  const financeCommentRef = useRef<FinanceComment | null>(null);
  const hasFetchedOnce = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!hasFetchedOnce.current) {
        hasFetchedOnce.current = true;
        fetchFinanceComment();
      } else {
        fetchFinanceComment(); // uses the 6h cache guard
      }
    }, [transactions])
  );

  // ---- Principles carousel state ----
  const [principleIndex, setPrincipleIndex] = useState(0);
  const carouselAnim = useRef(new Animated.Value(0)).current;
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    carouselTimer.current = setInterval(() => {
      Animated.timing(carouselAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setPrincipleIndex((i) => (i + 1) % PRINCIPLES.length);
          carouselAnim.setValue(0);
        }
      });
    }, 5000);
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [carouselAnim]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  })();

  const principle = PRINCIPLES[principleIndex];
  const principleIcon = PRINCIPLE_ICONS[principleIndex % PRINCIPLE_ICONS.length];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(123,142,255,0.10)', 'rgba(94,230,255,0.04)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.appBar}>
          <DrawerTrigger />
          <View style={styles.appBarCenter}>
            <Text style={styles.appBarTitle}>{greeting}</Text>
            <Text style={styles.appBarSub}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.appBarSide} />
        </View>

        {/* Daily quote */}
        <Entrance index={0}>
          <GlassCard glow="indigo" radius={24} pad={false}>
            <View style={styles.quoteBody}>
              <LinearGradient
                colors={['#8b95ff', '#5ee6ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quoteMark}
              >
                <Ionicons name="sunny-outline" size={16} color="#0A0A10" />
              </LinearGradient>
              <Text style={styles.quoteLabel}>TODAY'S QUOTE</Text>
              <Text style={styles.quoteText}>"{quote.text}"</Text>
              <Text style={styles.quoteSource}>— {quote.source}</Text>
            </View>
          </GlassCard>
        </Entrance>

        {/* Habit progress */}
        <Entrance index={1}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('MoreStack', { screen: 'HabitTracker' })}>
            <GlassCard glow={progress >= 1 ? 'teal' : 'indigo'} radius={24}>
              <View style={styles.habitHeadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitLabel}>HABITS TODAY</Text>
                  <Text style={styles.habitBig}>{pct}%</Text>
                  <Text style={styles.habitSub}>
                    {ticked.length} of {HABITS.length} done
                    {bestStreak > 0 ? `  ·  best streak ${bestStreak}d 🔥` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tc.textMuted} />
              </View>

              <View style={styles.barTrack}>
                <LinearGradient
                  colors={progress >= 1 ? ['#4fdbcc', '#2fd48a'] : ['#8b95ff', '#5ee6ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.barFill, { width: `${Math.max(progress * 100, 4)}%` }]}
                />
              </View>
              <Text style={styles.barBlocks}>{progressBlocks(ticked)}</Text>

              <View style={styles.quickRow}>
                {HABITS.map((h) => {
                  const done = ticked.includes(h.key);
                  const streak = streaks.find((s) => s.key === h.key)?.streak ?? 0;
                  return (
                    <TouchableOpacity
                      key={h.key}
                      style={[styles.quickDot, done && styles.quickDotDone]}
                      onPress={() => useHabitStore.getState().toggleHabit(today, h.key, user?.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickEmoji}>{h.emoji}</Text>
                      {streak >= 3 && <View style={styles.streakBadge}><Text style={styles.streakBadgeText}>{streak}</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          </TouchableOpacity>
        </Entrance>

        {/* Sleep info */}
        <Entrance index={2}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('MoreStack', { screen: 'SleepTracker' })}>
            <GlassCard glow="cyan" radius={24}>
              <View style={styles.habitHeadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sleepLabel}>SLEEP</Text>
                  {sleepInfo.last ? (
                    <>
                      <Text style={styles.sleepBig}>
                        {formatSleepDuration(sleepDurationHours(sleepInfo.last))}
                      </Text>
                      <Text style={styles.habitSub}>
                        last night · {sleepInfo.count} nights logged
                        {sleepInfo.avg ? `  ·  7-night avg ${formatSleepDuration(sleepInfo.avg)}` : ''}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.sleepBigNone}>No nights yet</Text>
                      <Text style={styles.habitSub}>Tap "Going to bed" tonight to start</Text>
                    </>
                  )}
                </View>
                <View style={styles.moonWrap}>
                  <Text style={styles.moonEmoji}>{sleepInfo.avg && sleepInfo.avg >= 6.5 ? '🌙✨' : '🌙'}</Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </Entrance>

        {/* AI finance commentary */}
        <Entrance index={3}>
          <GlassCard glow="amber" radius={24} pad={false}>
            <View style={styles.financeBody}>
              <View style={styles.financeHead}>
                <LinearGradient
                  colors={['#ffd9a0', '#e2a45c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.financeIcon}
                >
                  <Ionicons name="sparkles" size={15} color="#0A0A10" />
                </LinearGradient>
                <Text style={styles.financeLabel}>MONEY NOTE · AI</Text>
                <TouchableOpacity
                  onPress={() => fetchFinanceComment(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={financeLoading}
                >
                  <Ionicons
                    name={financeLoading ? 'hourglass-outline' : 'refresh'}
                    size={16}
                    color={tc.textMuted}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.financeText}>
                {financeLoading && !financeComment
                  ? 'Reading your spends…'
                  : financeComment?.comment ?? 'Log a few transactions and I\u2019ll comment on your spending.'}
              </Text>
            </View>
          </GlassCard>
        </Entrance>

        {/* Stress release techniques */}
        <Entrance index={4}>
          <Text style={styles.sectionTitle}>STRESS RELEASE · 2 EASY TECHNIQUES</Text>
          <View style={styles.techRow}>
            {techniques.map((t) => (
              <View key={t.name} style={styles.techCardHalf}>
                <View style={styles.techIcon}>
                  <Text style={styles.techEmoji}>{t.emoji}</Text>
                </View>
                <Text style={styles.techName}>{t.name}</Text>
                <Text style={styles.techSteps}>{t.steps}</Text>
              </View>
            ))}
          </View>
        </Entrance>

        {/* Growth principles — auto-rotating carousel */}
        <Entrance index={5}>
          <Text style={styles.sectionTitle}>GROWTH PRINCIPLES</Text>
          <View style={styles.carouselWrap}>
            <Animated.View
              style={{
                opacity: carouselAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.35, 0] }),
                transform: [
                  {
                    translateX: carouselAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }),
                  },
                ],
              }}
            >
              <View style={styles.principleCardRow}>
                <View style={styles.principleIconBig}>
                  <LinearGradient
                    colors={['rgba(79,219,204,0.2)', 'rgba(123,142,255,0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name={principleIcon} size={20} color="#4fdbcc" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.principleTitleBig}>{principle.title}</Text>
                  <Text style={styles.principleBodyBig}>{principle.body}</Text>
                </View>
              </View>
            </Animated.View>
            {/* dots */}
            <View style={styles.carouselDots}>
              {PRINCIPLES.map((_, i) => (
                <View key={i} style={[styles.carouselDot, i === principleIndex && styles.carouselDotActive]} />
              ))}
            </View>
          </View>
        </Entrance>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  appBarCenter: { flex: 1, alignItems: 'center' },
  appBarSide: { width: 42, height: 42 },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  appBarSub: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 1,
  },
  quoteBody: {
    padding: 18,
    gap: 10,
  },
  quoteMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(139,149,255,0.85)',
    letterSpacing: 2,
  },
  quoteText: {
    fontSize: 17,
    fontWeight: '600',
    color: tc.textPrimary,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  quoteSource: {
    fontSize: 12,
    color: tc.textMuted,
    alignSelf: 'flex-end',
  },
  habitHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  habitLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(139,149,255,0.85)',
    letterSpacing: 2,
  },
  sleepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(94,230,255,0.85)',
    letterSpacing: 2,
  },
  habitBig: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -1,
  },
  sleepBig: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -1,
  },
  sleepBigNone: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  moonWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(94,230,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,230,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonEmoji: { fontSize: 22 },
  habitSub: {
    fontSize: 12,
    color: tc.textMuted,
    marginTop: 2,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barBlocks: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 8,
    letterSpacing: 1,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  quickDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  quickDotDone: {
    backgroundColor: 'rgba(79,219,204,0.18)',
    borderColor: 'rgba(79,219,204,0.5)',
  },
  quickEmoji: { fontSize: 16 },
  streakBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ea6479',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  streakBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  financeBody: { padding: 18, gap: 10 },
  financeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  financeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  financeLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(226,164,92,0.9)',
    letterSpacing: 2,
  },
  financeText: {
    fontSize: 14,
    fontWeight: '500',
    color: tc.textPrimary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    marginBottom: 10,
  },
  techRow: {
    flexDirection: 'row',
    gap: 10,
  },
  techCardHalf: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rounded.lg,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  techIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(94,230,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  techEmoji: { fontSize: 15 },
  techName: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  techSteps: {
    fontSize: 11,
    color: tc.textMuted,
    lineHeight: 16,
  },
  carouselWrap: {
    gap: 12,
  },
  principleCardRow: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(79,219,204,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,219,204,0.25)',
    borderRadius: rounded.xl,
    padding: 18,
    minHeight: 108,
    alignItems: 'center',
  },
  principleIconBig: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,219,204,0.3)',
    overflow: 'hidden',
  },
  principleTitleBig: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  principleBodyBig: {
    fontSize: 12.5,
    color: tc.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  carouselDotActive: {
    backgroundColor: '#4fdbcc',
    width: 18,
  },
});
