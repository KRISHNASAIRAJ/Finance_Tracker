/**
 * MainHomeScreen — the Home tab.
 *
 * Layout follows the Meridian v2 reference: a greeting header, a two-column
 * grid (habits ring / sleep / due today), the daily quote and the AI money
 * note. The stress-release techniques and the growth-principles carousel are
 * kept below — they are existing features and still work exactly as before.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  IconTile,
  Label,
  ProgressBar,
  Ring,
  Rise,
  Screen,
  Sparkline,
} from '../../../shared/components/meridian';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import { quoteForDate, stressTechniquesForDate, PRINCIPLES } from '../../../shared/dailyContent';
import {
  todayKey,
  dayProgress,
  habitStreak,
  habitBestStreak,
} from '../../habits/habits';
import { useHabitStore, habitsForDay, useHabitDefs } from '../../habits/store';
import { useSleepStore, sleepDurationHours, formatSleepDuration } from '../../sleep/store';
import { useFinanceStore } from '../../finance/store';
import { useTasksStore } from '../../tasks/store';
import { useAuth } from '../../../services/AuthProvider';
import { supabase } from '../../../services/supabaseClient';
import useWeather from '../../../hooks/useWeather';
import {
  formatTemp,
  type WeatherFailure,
  type WeatherIcon,
} from '../../../services/weather';
import { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FinanceComment {
  comment: string;
  fetchedAt: number;
}

const PRINCIPLE_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'flash-outline', 'ban-outline', 'cube-outline', 'flag-outline', 'trending-up-outline', 'hardware-chip-outline',
];

const WEATHER_ICONS: Record<WeatherIcon, keyof typeof Ionicons.glyphMap> = {
  sun: 'sunny',
  cloud: 'cloudy',
  rain: 'rainy',
  snow: 'snow',
  storm: 'thunderstorm',
};

const WEATHER_FAILURE_TEXT: Record<WeatherFailure, string> = {
  'permission-denied': 'Location is off for Meridian. Enable it or use a city.',
  'location-off': 'Location services are off on this phone. Turn them on or use a city.',
  'no-location': "We couldn't get your location. Try again or use a city.",
  'network-error': "Couldn't reach the weather service. Try again.",
  'no-city': "We couldn't find that city. Check the name and retry.",
  'no-data': 'No reading yet. Enable location or add a city.',
};

export default function MainHomeScreen() {
  const navigation = useNavigation<Nav>();
  const days = useHabitStore((s) => s.days);
  const sleepEntries = useSleepStore((s) => s.entries);
  const tasks = useTasksStore((s) => s.tasks);
  const transactions = useFinanceStore((s) => s.transactions);
  const { user } = useAuth();

  // Live weather — the avatar is the app's temperature readout.
  const { weather, failure, refreshing, refresh, grantLocation, useCity } = useWeather();
  const [showWeather, setShowWeather] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [cityBusy, setCityBusy] = useState(false);
  const avatarPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) {
      avatarPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(avatarPulse, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, avatarPulse]);

  const today = todayKey();
  const ticked = habitsForDay(days, today);
  const HABITS = useHabitDefs();
  const progress = dayProgress(ticked, HABITS);
  const pct = Math.round(progress * 100);

  // The current streak per habit (used for the little badge on each dot).
  const streaks = HABITS.map((h) => ({
    ...h,
    streak: habitStreak(h.key, (k) => habitsForDay(days, k)),
  }));

  // The all-time best streak — derived from the logged days, no extra data.
  const bestStreak = useMemo(() => {
    let best = 0;
    for (const h of HABITS) {
      const logged = days.filter((d) => (d.habits || []).includes(h.key)).map((d) => d.day);
      best = Math.max(best, habitBestStreak(h.key, logged));
    }
    return best;
  }, [days, HABITS]);

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
    // The trend line the reference draws under the sleep total.
    const trend = [...last7].reverse().map((e) => sleepDurationHours(e));
    return { last, avg, count: sorted.length, trend };
  }, [sleepEntries]);

  // ---- Tasks due today ----
  const dueToday = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 86400000;
    const todays = tasks.filter((t) => {
      const d = new Date(t.dueDate).getTime();
      return d >= startOfDay && d < endOfDay;
    });
    const open = todays.filter((t) => !t.completed).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    const next = open[0] ?? null;
    return {
      openCount: open.length,
      total: todays.length,
      done: todays.length - open.length,
      next,
    };
  }, [tasks]);

  // ---- AI finance commentary ----
  const [financeComment, setFinanceComment] = useState<FinanceComment | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

  const buildFinanceContext = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // Wallet loads / rent / SIP / investments are transfers, not spends —
    // exclude them so the note talks about REAL spending, not wallet top-ups.
    const EXCLUDED = new Set(['wallet loads', 'wallet load', 'rent', 'sip', 'investments', 'housing']);
    const isSpend = (t: any) =>
      ['expense', 'fuel_purchase', 'vehicle_service'].includes(t.type) &&
      !EXCLUDED.has((t.category || '').toLowerCase()) &&
      !((t.notes || '').toLowerCase().includes('wallet load') || (t.notes || '').toLowerCase().includes('payzapp'));

    const monthTxns = transactions.filter((t: any) => isSpend(t) && String(t.date).slice(0, 7) === monthKey);
    const prevTxns = transactions.filter((t: any) => isSpend(t) && String(t.date).slice(0, 7) === prev);

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

    // Overall finance picture — not just spends, so the note covers the
    // whole month: income, balances, credit cards, lending and net worth.
    const fin = useFinanceStore.getState();
    const monthIncome = fin.transactions
      .filter((t: any) => t.type === 'income' && String(t.date).slice(0, 7) === monthKey)
      .reduce((s: number, t: any) => s + t.amount / 100, 0);
    const totalBalance = fin.accounts.reduce((s: number, a: any) => s + (a.amount ?? 0), 0) / 100;
    const cardOutstanding = fin.cards.reduce((s: number, c: any) => s + (c.balance ?? 0), 0) / 100;
    const lentOut = fin.receivables
      .filter((r: any) => r.type === 'lent')
      .reduce((s: number, r: any) => s + ((r.amount ?? 0) - (r.paidAmount ?? 0)) / 100, 0);
    const borrowed = fin.receivables
      .filter((r: any) => r.type === 'borrowed')
      .reduce((s: number, r: any) => s + ((r.amount ?? 0) - (r.paidAmount ?? 0)) / 100, 0);

    return {
      monthLabel: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      totalSpendRupees: Math.round(monthTxns.reduce((s: number, t: any) => s + t.amount / 100, 0)),
      budgetRupees: fin.monthlyBudget > 0 ? fin.monthlyBudget : null,
      topDay,
      biggestTx: biggest,
      lastMonthTotalRupees: prevTxns.length > 0
        ? Math.round(prevTxns.reduce((s: number, t: any) => s + t.amount / 100, 0))
        : null,
      categories: categories.slice(0, 8),
      monthIncomeRupees: Math.round(monthIncome),
      bankBalanceRupees: Math.round(totalBalance),
      cardOutstandingRupees: Math.round(cardOutstanding),
      lentOutRupees: Math.round(lentOut),
      borrowedRupees: Math.round(borrowed),
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
        // If transactions changed since the note was generated, refresh it so
        // the note always reflects current data (not a stale cached comment).
        const cached = (financeCommentRef as unknown as { current: FinanceComment | null }).current;
        if (cached && Date.now() - cached.fetchedAt > 15 * 60 * 1000) {
          fetchFinanceComment(true);
        } else {
          fetchFinanceComment(); // uses the cache guard
        }
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

  const dateLabel = new Date()
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

  const sleepBed = sleepInfo.last
    ? new Date(sleepInfo.last.startTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;
  const sleepWake = sleepInfo.last
    ? new Date(sleepInfo.last.endTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const nextTaskTime = dueToday.next
    ? new Date(dueToday.next.dueDate).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const habitColors = [mc.violet, mc.sky, mc.mint, mc.amber];

  return (
    <Screen bottomInset={120}>
      {/* Header — date, greeting and the account avatar */}
      <Rise index={0}>
        <View style={styles.header}>
          <DrawerTrigger />
          <View style={styles.headerText}>
            <Label small>{dateLabel}</Label>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
          <Animated.View
            style={[
              styles.avatarWrap,
              {
                opacity: avatarPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.55],
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.85}
              accessibilityLabel="Weather — tap for details"
              onPress={() => {
                setShowCityInput(!!failure);
                setShowWeather(true);
              }}
            >
              {weather ? (
                <>
                  <Text style={styles.avatarTemp}>{formatTemp(weather.tempC)}</Text>
                  <Ionicons
                    name={WEATHER_ICONS[weather.icon]}
                    size={10}
                    color={mc.white}
                    style={styles.avatarIcon}
                  />
                </>
              ) : (
                <Ionicons name="cloudy-outline" size={20} color={mc.white} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Rise>

      {/* The two-column grid: habits / sleep / due today */}
      <View style={styles.grid}>
        {/* Habits — the ring card, spanning both rows */}
        <Rise index={1} style={styles.habitsCell}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate('MoreStack', { screen: 'HabitTracker' })}
          >
            <Card style={styles.habitsCard}>
              <Label>HABITS</Label>
              <View style={styles.ringWrap}>
                <Ring progress={progress} size={112} stroke={9} color={mc.red}>
                  <Text style={styles.ringText}>
                    {ticked.length}/{HABITS.length}
                  </Text>
                </Ring>
              </View>
              <Text style={styles.streakLabel}>Best streak</Text>
              <Text style={styles.streakValue}>
                {bestStreak} {bestStreak === 1 ? 'day' : 'days'}
              </Text>
              <View style={styles.habitDots}>
                {HABITS.map((h, i) => {
                  const done = ticked.includes(h.key);
                  const streak = streaks.find((s) => s.key === h.key)?.streak ?? 0;
                  return (
                    <TouchableOpacity
                      key={h.key}
                      style={[
                        styles.habitDot,
                        done && { backgroundColor: mc.mintDim, borderColor: mc.mint },
                      ]}
                      onPress={() => useHabitStore.getState().toggleHabit(today, h.key, user?.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.habitEmoji}>{h.emoji}</Text>
                      {streak >= 3 ? (
                        <View style={styles.streakBadge}>
                          <Text style={styles.streakBadgeText}>{streak}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          </TouchableOpacity>
        </Rise>

        {/* Right column: sleep on top, due today directly beneath it */}
        <View style={styles.rightColumn}>
        <Rise index={2} style={styles.rightFill}>
          <TouchableOpacity
            style={styles.fillTap}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('MoreStack', { screen: 'SleepTracker' })}
          >
            <Card style={styles.rightCard}>
              <Label>SLEEP</Label>
              {sleepInfo.last ? (
                <>
                  <Text style={styles.cardValue}>{formatSleepDuration(sleepDurationHours(sleepInfo.last))}</Text>
                  {sleepInfo.trend.length > 1 ? (
                    <Sparkline data={sleepInfo.trend} width={140} height={30} color={mc.violet} />
                  ) : null}
                  <View style={styles.footRow}>
                    <Text style={styles.footText}>{sleepBed}</Text>
                    <Text style={styles.footText}>{sleepWake}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.cardValueSmall}>No nights yet</Text>
              )}
            </Card>
          </TouchableOpacity>
        </Rise>

        {/* Due today */}
        <Rise index={3} style={styles.rightFill}>
          <TouchableOpacity
            style={styles.fillTap}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'TasksDashboard' } })}
          >
            <Card style={styles.rightCard}>
              <Label>DUE TODAY</Label>
              <Text style={styles.cardValue}>
                <Text style={{ color: dueToday.openCount > 0 ? mc.amber : mc.mint }}>
                  {dueToday.openCount}
                </Text>
                {dueToday.openCount === 1 ? ' task' : ' tasks'}
              </Text>
              <Text style={styles.cardSub}>
                {dueToday.next ? `Next: ${nextTaskTime}` : 'Nothing pending'}
              </Text>
              <ProgressBar
                value={dueToday.total > 0 ? dueToday.done / dueToday.total : 0}
                color={mc.amber}
                height={6}
                style={styles.cardBar}
              />
            </Card>
          </TouchableOpacity>
        </Rise>
        </View>
      </View>

      {/* Today's quote */}
      <Rise index={4}>
        <Card style={styles.quoteCard}>
          <View style={styles.quoteBar} />
          <View style={styles.quoteBody}>
            <Label>TODAY'S QUOTE</Label>
            <Text style={styles.quoteText}>{quote.text}</Text>
            <Text style={styles.quoteSource}>— {quote.source}</Text>
          </View>
        </Card>
      </Rise>

      {/* Money note (AI) */}
      <Rise index={5}>
        <Card tone="mint" style={styles.noteCard}>
          <View style={styles.noteHead}>
            <Ionicons name="sparkles" size={13} color={mc.mint} />
            <Label color={mc.mint} style={styles.noteLabel}>MONEY NOTE</Label>
            <TouchableOpacity
              onPress={() => fetchFinanceComment(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={financeLoading}
            >
              <Ionicons
                name={financeLoading ? 'hourglass-outline' : 'refresh'}
                size={15}
                color={mc.mint}
              />
            </TouchableOpacity>
          </View>
          {financeLoading && !financeComment ? (
            <View style={styles.skeleton}>
              <View style={[styles.skeletonLine, { width: '92%' }]} />
              <View style={[styles.skeletonLine, { width: '78%' }]} />
              <View style={[styles.skeletonLine, { width: '45%' }]} />
            </View>
          ) : (
            <Text style={styles.noteText}>
              {financeComment?.comment ?? 'Log a few transactions and I\u2019ll comment on your spending.'}
            </Text>
          )}
        </Card>
      </Rise>

      {/* Stress release techniques */}
      <Rise index={6}>
        <Label style={styles.sectionTitle}>STRESS RELEASE · {techniques.length} EASY TECHNIQUES</Label>
        <View style={styles.techRow}>
          {techniques.map((t) => (
            <View key={t.name} style={styles.techCard}>
              <IconTile icon="leaf-outline" color={mc.mint} size={34} radius={11} />
              <Text style={styles.techName}>{t.name}</Text>
              <Text style={styles.techSteps}>{t.steps}</Text>
            </View>
          ))}
        </View>
      </Rise>

      {/* Growth principles — auto-rotating carousel */}
      <Rise index={7}>
        <Label style={styles.sectionTitle}>GROWTH PRINCIPLES</Label>
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
            <View style={styles.principleCard}>
              <IconTile icon={principleIcon} color={mc.violet} size={44} radius={15} />
              <View style={styles.principleText}>
                <Text style={styles.principleTitle}>{principle.title}</Text>
                <Text style={styles.principleBody}>{principle.body}</Text>
              </View>
            </View>
          </Animated.View>
          <View style={styles.carouselDots}>
            {PRINCIPLES.map((_, i) => (
              <View
                key={i}
                style={[styles.carouselDot, i === principleIndex && styles.carouselDotActive]}
              />
            ))}
          </View>
        </View>
      </Rise>

      {/* Weather detail sheet — opened by the temperature avatar */}
      <Modal
        visible={showWeather}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowWeather(false)}
      >
        <Pressable style={weatherStyles.backdrop} onPress={() => setShowWeather(false)}>
          <Pressable style={weatherStyles.sheet} onPress={() => {}}>
            <View style={weatherStyles.handle} />
            <View style={weatherStyles.sheetHead}>
              <Label small>WEATHER</Label>
              <TouchableOpacity
                onPress={() => setShowWeather(false)}
                accessibilityLabel="Close weather"
              >
                <Ionicons name="close" size={18} color={mc.textDim} />
              </TouchableOpacity>
            </View>

            <View style={weatherStyles.nowRow}>
              <View style={weatherStyles.nowIcon}>
                <Ionicons
                  name={weather ? WEATHER_ICONS[weather.icon] : 'cloudy-outline'}
                  size={30}
                  color={mc.red}
                />
              </View>
              <View style={weatherStyles.nowText}>
                <Text style={weatherStyles.bigTemp}>
                  {weather ? formatTemp(weather.tempC) : '—'}
                </Text>
                <Text style={weatherStyles.condition}>
                  {weather?.condition || 'No reading yet'}
                </Text>
              </View>
            </View>

            {weather && (
              <>
                <View style={weatherStyles.statRow}>
                  <View style={weatherStyles.stat}>
                    <Text style={weatherStyles.statLabel}>FEELS LIKE</Text>
                    <Text style={weatherStyles.statValue}>{formatTemp(weather.feelsLikeC)}</Text>
                  </View>
                  <View style={weatherStyles.stat}>
                    <Text style={weatherStyles.statLabel}>LOW</Text>
                    <Text style={weatherStyles.statValue}>{formatTemp(weather.minC)}</Text>
                  </View>
                  <View style={weatherStyles.stat}>
                    <Text style={weatherStyles.statLabel}>HIGH</Text>
                    <Text style={weatherStyles.statValue}>{formatTemp(weather.maxC)}</Text>
                  </View>
                  <View style={weatherStyles.stat}>
                    <Text style={weatherStyles.statLabel}>HUMIDITY</Text>
                    <Text style={weatherStyles.statValue}>{Math.round(weather.humidity)}%</Text>
                  </View>
                </View>
                <Text style={weatherStyles.updated}>
                  {weather.placeName ? `${weather.placeName} · ` : ''}
                  {'Updated '}
                  {Math.max(0, Math.round((Date.now() - weather.fetchedAt) / 60000))} min ago
                </Text>
              </>
            )}

            {failure && (
              <View style={weatherStyles.warning}>
                <Ionicons name="warning-outline" size={16} color={mc.amber} />
                <Text style={weatherStyles.warningText}>{WEATHER_FAILURE_TEXT[failure]}</Text>
              </View>
            )}

            <TouchableOpacity style={weatherStyles.primaryBtn} onPress={() => { refresh(); }}>
              <Text style={weatherStyles.primaryBtnText}>
                {refreshing ? 'REFRESHING…' : 'REFRESH NOW'}
              </Text>
            </TouchableOpacity>

            {failure === 'permission-denied' && (
              <TouchableOpacity style={weatherStyles.secondaryBtn} onPress={grantLocation}>
                <Text style={weatherStyles.secondaryBtnText}>ENABLE LOCATION</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={weatherStyles.cityToggle}
              onPress={() => setShowCityInput((v) => !v)}
            >
              <Text style={weatherStyles.cityToggleText}>
                {showCityInput ? 'Hide city input' : 'Use a city instead'}
              </Text>
            </TouchableOpacity>

            {showCityInput && (
              <View style={weatherStyles.cityRow}>
                <TextInput
                  style={weatherStyles.cityInput}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor={mc.textFaint}
                  value={cityInput}
                  onChangeText={setCityInput}
                  autoCapitalize="words"
                  returnKeyType="go"
                  onSubmitEditing={async () => {
                    if (!cityInput.trim()) return;
                    setCityBusy(true);
                    const ok = await useCity(cityInput);
                    setCityBusy(false);
                    if (ok) {
                      setCityInput('');
                      setShowCityInput(false);
                    }
                  }}
                />
                <TouchableOpacity
                  style={weatherStyles.cityButton}
                  disabled={cityBusy || !cityInput.trim()}
                  onPress={async () => {
                    setCityBusy(true);
                    const ok = await useCity(cityInput);
                    setCityBusy(false);
                    if (ok) {
                      setCityInput('');
                      setShowCityInput(false);
                    }
                  }}
                >
                  <Text style={weatherStyles.cityButtonText}>{cityBusy ? '…' : 'USE'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTemp: {
    fontSize: 16,
    fontWeight: '700',
    color: mc.white,
    letterSpacing: -0.4,
  },
  avatarIcon: {
    position: 'absolute',
    top: 3,
    right: 4,
  },

  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  habitsCell: {
    width: '48%',
  },
  rightColumn: {
    width: '48%',
    gap: 10,
  },
  rightFill: {
    flex: 1,
  },
  fillTap: {
    flex: 1,
  },
  habitsCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  ringWrap: {
    marginVertical: 12,
  },
  ringText: {
    fontSize: 22,
    fontWeight: '500',
    color: mc.text,
  },
  streakLabel: {
    fontSize: 13,
    color: mc.textDim,
    textAlign: 'center',
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  habitDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  habitDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mc.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mc.track,
  },
  habitEmoji: {
    fontSize: 14,
  },
  streakBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  streakBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: mc.white,
  },

  rightCard: {
    flex: 1,
    minHeight: 128,
    justifyContent: 'flex-start',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '500',
    color: mc.text,
    marginVertical: 4,
  },
  cardValueSmall: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.textDim,
    marginVertical: 4,
  },
  cardSub: {
    fontSize: 12,
    color: mc.textDim,
  },
  cardBar: {
    marginTop: 'auto',
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  footText: {
    fontSize: 11,
    color: mc.textDim,
  },

  quoteCard: {
    flexDirection: 'row',
    gap: 12,
  },
  quoteBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: mc.red,
  },
  quoteBody: {
    flex: 1,
  },
  quoteText: {
    fontSize: 15,
    color: mc.text,
    lineHeight: 22,
    marginTop: 6,
  },
  quoteSource: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 6,
  },

  noteCard: {
    padding: 14,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteLabel: {
    flex: 1,
  },
  noteText: {
    fontSize: 13,
    color: mc.mintText,
    lineHeight: 20,
    marginTop: 6,
  },
  skeleton: {
    gap: 8,
    paddingVertical: 6,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  techRow: {
    flexDirection: 'row',
    gap: 10,
  },
  techCard: {
    flex: 1,
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  techName: {
    fontSize: 13,
    fontWeight: '500',
    color: mc.text,
  },
  techSteps: {
    fontSize: 11,
    color: mc.textDim,
    lineHeight: 16,
  },

  carouselWrap: {
    gap: 12,
  },
  principleCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 18,
    minHeight: 108,
    alignItems: 'center',
  },
  principleText: {
    flex: 1,
  },
  principleTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  principleBody: {
    fontSize: 12.5,
    color: mc.textDim,
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
    backgroundColor: mc.track,
  },
  carouselDotActive: {
    backgroundColor: mc.mint,
    width: 18,
  },
});

/** The weather sheet — kept separate from the screen's dense style table. */
const weatherStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: mc.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: mc.lineSoft,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: mc.track,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  nowIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: mc.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowText: {
    flex: 1,
  },
  bigTemp: {
    fontSize: 40,
    fontWeight: '600',
    color: mc.text,
    letterSpacing: -1,
  },
  condition: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: -2,
  },
  statRow: {
    flexDirection: 'row',
    backgroundColor: mc.raised,
    borderRadius: 16,
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: mc.lineSoft,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    color: mc.textDim,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: mc.text,
    marginTop: 5,
  },
  updated: {
    fontSize: 11,
    color: mc.textFaint,
    marginTop: 10,
    textAlign: 'center',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: mc.amberDim,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: mc.amber,
    lineHeight: 17,
  },
  primaryBtn: {
    backgroundColor: mc.red,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: mc.white,
  },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mc.red,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: mc.redSoft,
  },
  cityToggle: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  cityToggleText: {
    fontSize: 12,
    color: mc.textDim,
    textDecorationLine: 'underline',
  },
  cityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cityInput: {
    flex: 1,
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: mc.text,
  },
  cityButton: {
    backgroundColor: mc.red,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: mc.white,
  },
});
