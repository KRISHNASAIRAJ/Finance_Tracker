/**
 * SnapshotDatesScreen — full-screen list of all portfolio snapshot dates with
 * values and day-over-day change. Opened from PortfolioHistory's "View All".
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
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { deleteCloudSnapshot } from '../hooks/useEquitySync';
import { useAuth } from '../../../services/AuthProvider';

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function SnapshotDatesScreen() {
  const navigation = useNavigation<any>();
  const { snapshots, deleteSnapshot } = useInvestmentsStore();
  const { user } = useAuth();

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const handleDelete = (date: string) => {
    deleteSnapshot(date);
    if (user?.id) {
      deleteCloudSnapshot(user.id, date).catch((e: Error) =>
        console.warn('[SnapshotDates] delete snapshot:', e)
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Snapshot Dates</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No snapshots yet</Text>
          </View>
        ) : (
          sorted.map((s, idx) => {
            const prev = idx + 1 < sorted.length ? sorted[idx + 1] : null;
            const change = prev ? s.totalValue - prev.totalValue : 0;
            const changePct = prev && prev.totalValue > 0 ? ((change / prev.totalValue) * 100).toFixed(1) : '0.0';
            return (
              <TouchableOpacity
                key={s.date}
                style={styles.row}
                onLongPress={() => handleDelete(s.date)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateText}>
                    {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  {prev && (
                    <Text style={[styles.changeText, { color: change >= 0 ? colors.success : colors.error }]}>
                      {change >= 0 ? '+' : ''}{formatCurrency(change)} ({change >= 0 ? '+' : ''}{changePct}%) vs prev
                    </Text>
                  )}
                </View>
                <Text style={styles.valueText}>{formatCurrency(s.totalValue)}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <Text style={styles.hint}>Long-press a date to delete that snapshot</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 10,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(155,165,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    color: colors.outline,
    textAlign: 'center',
    marginTop: 8,
  },
});
