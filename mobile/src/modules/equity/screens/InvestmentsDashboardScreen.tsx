import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { useFinanceStore } from '../../finance/store';
import { InvestmentsStackParamList } from '../../../navigation/RootNavigator';
import SidebarDrawer from '../../../shared/components/SidebarDrawer';

type NavigationProp = NativeStackNavigationProp<InvestmentsStackParamList, 'InvestmentsDashboard'>;

export default function InvestmentsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { holdings, goals, getPortfolioValue } = useInvestmentsStore();
  const notifications = useFinanceStore((state) => state.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const portfolioValue = getPortfolioValue();

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const formatCurrencyDetailed = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Shared slide-out left Drawer */}
      <SidebarDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
      />

      {/* Top Header */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Investments</Text>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('PortfolioHistory')}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications' as any)}>
            <View style={styles.notificationWrapper}>
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              {unreadCount > 0 && <View style={styles.notificationDot} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Portfolio Value Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(portfolioValue)}</Text>
          <View style={styles.heroSubRow}>
            <View style={styles.trendBadge}>
              <Ionicons name="trending-up" size={12} color={colors.success} />
              <Text style={styles.trendText}>+8.3% P&L</Text>
            </View>
            <Text style={styles.heroSubText}>All-time unrealized gains</Text>
          </View>
        </View>

        {/* AI Recommendations Action Card */}
        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => navigation.navigate('AIRecommendations')}
          activeOpacity={0.9}
        >
          <View style={styles.aiLeft}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
            <View>
              <Text style={styles.aiTitle}>AI Rebalancing Recommendations</Text>
              <Text style={styles.aiSubtitle}>Review allocation suggestions based on goals</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* Financial Investment Goals Progress Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>INVESTMENT GOALS</Text>
          <View style={styles.goalsList}>
            {goals.map((g) => {
              const progress = g.current / g.target;
              const percentText = `${Math.round(progress * 100)}%`;
              return (
                <View key={g.id} style={styles.goalRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalName}>{g.name}</Text>
                    <Text style={styles.goalPercent}>{percentText}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalProgressDetails}>
                      {formatCurrency(g.current)} of {formatCurrency(g.target)}
                    </Text>
                    <Text style={styles.goalProgressDetails}>
                      Target: {new Date(g.dueDate).getFullYear()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Holdings List Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>EQUITY HOLDINGS</Text>
          <View style={styles.holdingsList}>
            {holdings.map((h) => {
              const totalValue = h.quantity * h.currentPrice;
              const totalCost = h.quantity * h.avgPrice;
              const profitLoss = totalValue - totalCost;
              const plPercent = ((profitLoss / totalCost) * 100).toFixed(1);
              const isProfit = profitLoss >= 0;

              return (
                <View key={h.symbol} style={styles.holdingRow}>
                  <View style={styles.holdingLeft}>
                    <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                    <Text style={styles.holdingName}>{h.name}</Text>
                    <Text style={styles.holdingQuantity}>
                      {h.quantity} Shares · Avg {formatCurrencyDetailed(h.avgPrice)}
                    </Text>
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={styles.holdingValue}>{formatCurrency(totalValue)}</Text>
                    <View style={[styles.plBadge, { backgroundColor: isProfit ? `${colors.success}15` : `${colors.error}15` }]}>
                      <Text style={[styles.plText, { color: isProfit ? colors.success : colors.error }]}>
                        {isProfit ? '+' : ''}
                        {plPercent}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.onSurface,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
  },
  trendText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
  },
  heroSubText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.primaryContainer}15`,
    borderColor: `${colors.primaryContainer}40`,
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  aiSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  goalsList: {
    gap: 16,
  },
  goalRow: {
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  goalPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: rounded.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.full,
  },
  goalProgressDetails: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  holdingsList: {
    gap: 12,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  holdingLeft: {
    gap: 3,
    flex: 1,
  },
  holdingSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  holdingName: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  holdingQuantity: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  holdingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  plBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
  },
  plText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
