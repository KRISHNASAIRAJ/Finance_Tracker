/**
 * MainHomeScreen — primary Home tab: daily quote, habit progress bar,
 * stress-release techniques, and productivity principles. The finance
 * dashboard lives on the second tab.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MainHomeScreen() {
  const navigation = useNavigation<Nav>();
  const days = useHabitStore((s) => s.days);

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

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  })();

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

              {/* progress bar */}
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={progress >= 1 ? ['#4fdbcc', '#2fd48a'] : ['#8b95ff', '#5ee6ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.barFill, { width: `${Math.max(progress * 100, 4)}%` }]}
                />
              </View>
              <Text style={styles.barBlocks}>{progressBlocks(ticked)}</Text>

              {/* quick tick row */}
              <View style={styles.quickRow}>
                {HABITS.map((h) => {
                  const done = ticked.includes(h.key);
                  const streak = streaks.find((s) => s.key === h.key)?.streak ?? 0;
                  return (
                    <TouchableOpacity
                      key={h.key}
                      style={[styles.quickDot, done && styles.quickDotDone]}
                      onPress={() => useHabitStore.getState().toggleHabit(today, h.key)}
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

        {/* Stress release techniques */}
        <Entrance index={2}>
          <Text style={styles.sectionTitle}>STRESS RELEASE · 2 EASY TECHNIQUES</Text>
          <View style={styles.techColumn}>
            {techniques.map((t) => (
              <View key={t.name} style={styles.techCard}>
                <View style={styles.techIcon}>
                  <Text style={styles.techEmoji}>{t.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.techName}>{t.name}</Text>
                  <Text style={styles.techSteps}>{t.steps}</Text>
                </View>
              </View>
            ))}
          </View>
        </Entrance>

        {/* Growth principles */}
        <Entrance index={3}>
          <Text style={styles.sectionTitle}>GROWTH PRINCIPLES</Text>
          <View style={styles.techColumn}>
            {PRINCIPLES.map((p) => (
              <View key={p.title} style={styles.principleCard}>
                <View style={styles.principleIcon}>
                  <Ionicons name="leaf-outline" size={14} color="#4fdbcc" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.principleTitle}>{p.title}</Text>
                  <Text style={styles.principleBody}>{p.body}</Text>
                </View>
              </View>
            ))}
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
  habitBig: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -1,
  },
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    marginBottom: 10,
  },
  techColumn: { gap: 10 },
  techCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rounded.lg,
    padding: 14,
    alignItems: 'flex-start',
  },
  techIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(94,230,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  techEmoji: { fontSize: 16 },
  techName: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  techSteps: {
    fontSize: 12,
    color: tc.textMuted,
    lineHeight: 17,
    marginTop: 3,
  },
  principleCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(79,219,204,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,219,204,0.18)',
    borderRadius: rounded.lg,
    padding: 14,
    alignItems: 'flex-start',
  },
  principleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79,219,204,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  principleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  principleBody: {
    fontSize: 12,
    color: tc.textMuted,
    lineHeight: 17,
    marginTop: 3,
  },
});
