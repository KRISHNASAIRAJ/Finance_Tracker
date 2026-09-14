/**
 * CareerGoalsScreen — 2025→2031 roadmap timeline with year goals.
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
import Entrance from '../../../shared/components/Entrance';
import { CAREER_GOALS, currentYearGoals } from '../../../shared/careerGoals';
import { MoreStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function CareerGoalsScreen() {
  const navigation = useNavigation<Nav>();
  const now = new Date();
  const currentYear = now.getFullYear();
  const activeGoals = currentYearGoals(now);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Career Goals</Text>
        <View style={styles.appBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeGoals && (
          <Entrance index={0}>
            <View style={styles.activeBanner}>
              <LinearGradient
                colors={['rgba(139,149,255,0.16)', 'rgba(79,219,204,0.08)', 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={styles.activeLabel}>FOCUS YEAR</Text>
              <Text style={styles.activeTitle}>
                {activeGoals.emoji} {activeGoals.year} · {activeGoals.title}
              </Text>
              <Text style={styles.activeCount}>
                {activeGoals.items.length} goals this year — the mission is personal.
              </Text>
            </View>
          </Entrance>
        )}

        {CAREER_GOALS.map((g, idx) => {
          const isPast = g.year < currentYear;
          const isActive = g.year === currentYear;
          return (
            <Entrance key={g.year} index={idx + 1}>
              <View style={[styles.yearCard, isActive && styles.yearCardActive]}>
                <View style={styles.yearHeadRow}>
                  <View style={styles.yearBadge}>
                    <Text style={[styles.yearBadgeText, isActive && styles.yearBadgeTextActive]}>{g.year}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.yearTitle}>
                      {g.emoji} {g.title}
                    </Text>
                    {isActive && <Text style={styles.yearNow}>THIS YEAR</Text>}
                    {isPast && <Text style={styles.yearDone}>Foundation laid 🌱</Text>}
                  </View>
                </View>
                <View style={styles.itemList}>
                  {g.items.map((it) => (
                    <View key={it} style={styles.itemRow}>
                      <View style={[styles.itemDot, isPast && styles.itemDotDone]} />
                      <Text style={[styles.itemText, isPast && styles.itemTextDone]}>{it}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Entrance>
          );
        })}
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 8,
    gap: 8,
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  appBarSide: { width: 40, height: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapMd,
    paddingBottom: 100,
  },
  activeBanner: {
    borderRadius: rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,149,255,0.3)',
    padding: 18,
    overflow: 'hidden',
    gap: 6,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(139,149,255,0.9)',
    letterSpacing: 2,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  activeCount: {
    fontSize: 12,
    color: tc.textMuted,
  },
  yearCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rounded.xl,
    padding: 16,
    gap: 12,
  },
  yearCardActive: {
    borderColor: 'rgba(139,149,255,0.45)',
    backgroundColor: 'rgba(139,149,255,0.07)',
  },
  yearHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearBadge: {
    width: 56,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
  },
  yearBadgeTextActive: { color: '#8b95ff' },
  yearTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  yearNow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b95ff',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  yearDone: {
    fontSize: 10,
    color: 'rgba(79,219,204,0.75)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  itemList: { gap: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 5,
  },
  itemDotDone: { backgroundColor: 'rgba(79,219,204,0.8)' },
  itemText: {
    flex: 1,
    fontSize: 13,
    color: tc.textPrimary,
    lineHeight: 18,
  },
  itemTextDone: {
    color: tc.textMuted,
  },
});
