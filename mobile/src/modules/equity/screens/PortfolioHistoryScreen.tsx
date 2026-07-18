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

export default function PortfolioHistoryScreen() {
  const navigation = useNavigation();

  const MOCK_HISTORY = [
    { id: '1', type: 'Buy', asset: 'RELIANCE', date: '2026-07-10', amount: '₹13,400', quantity: '5 shares' },
    { id: '2', type: 'Buy', asset: 'HDFCBANK', date: '2026-07-01', amount: '₹15,100', quantity: '10 shares' },
    { id: '3', type: 'SIP', asset: 'Parag Parikh Flexi Cap', date: '2026-06-25', amount: '₹5,000', quantity: 'MF Units' },
    { id: '4', type: 'Sell', asset: 'TCS', date: '2026-06-12', amount: '₹11,460', quantity: '3 shares' },
    { id: '5', type: 'SIP', asset: 'Parag Parikh Flexi Cap', date: '2026-05-25', amount: '₹5,000', quantity: 'MF Units' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Transaction History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.historyCard}>
          {MOCK_HISTORY.map((h) => {
            const isBuy = h.type === 'Buy' || h.type === 'SIP';
            return (
              <View key={h.id} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <View style={[styles.badge, { backgroundColor: isBuy ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)' }]}>
                    <Text style={[styles.badgeText, { color: isBuy ? colors.success : colors.error }]}>
                      {h.type}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.historyAsset}>{h.asset}</Text>
                    <Text style={styles.historyQty}>{h.quantity}</Text>
                  </View>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.historyAmount, { color: isBuy ? colors.onSurface : colors.error }]}>
                    {isBuy ? '-' : '+'}{h.amount}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    paddingBottom: 40,
  },
  historyCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.DEFAULT,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyAsset: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  historyQty: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});
