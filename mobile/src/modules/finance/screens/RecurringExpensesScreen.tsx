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
import { useFinanceStore } from '../store';

export default function RecurringExpensesScreen() {
  const navigation = useNavigation();
  const { cards } = useFinanceStore();

  const totalOutstanding = cards.reduce((sum, c) => sum + c.balance, 0);

  const MOCK_SIP_LIST = [
    { id: 'sip-1', name: 'SIP Mutual Fund (Parag Parikh)', amount: 200000, day: '27th' },
    { id: 'sip-2', name: 'SIP Quant Active Fund', amount: 25000, day: '7th' },
    { id: 'sip-3', name: 'SIP Nippon Small Cap', amount: 25000, day: '15th' },
  ];

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Recurring & Dues</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Outstanding Dues */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL CREDIT CARD OUTSTANDING</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
        </View>

        {/* Credit Card Dues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE CARD BILLS</Text>
          <View style={styles.listContainer}>
            {cards.map((card) => (
              <View key={card.id} style={styles.rowItem}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${colors.error}15` }]}>
                    <Ionicons name="card-outline" size={18} color={colors.error} />
                  </View>
                  <View>
                    <Text style={styles.itemTitle}>{card.name} (•• {card.endingWith})</Text>
                    <Text style={styles.itemSubtitle}>Billing day: {card.billingDay}th</Text>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{formatCurrency(card.balance)}</Text>
                  <Text style={styles.dueDateText}>
                    Due {new Date(card.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* SIP & Investments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONTHLY RECURRING SIPs</Text>
          <View style={styles.listContainer}>
            {MOCK_SIP_LIST.map((sip) => (
              <View key={sip.id} style={styles.rowItem}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${colors.success}15` }]}>
                    <Ionicons name="trending-up-outline" size={18} color={colors.success} />
                  </View>
                  <View>
                    <Text style={styles.itemTitle}>{sip.name}</Text>
                    <Text style={styles.itemSubtitle}>Triggers every {sip.day}</Text>
                  </View>
                </View>
                <Text style={[styles.itemAmount, { color: colors.success }]}>
                  {formatCurrency(sip.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fixed Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FIXED COST DUES</Text>
          <View style={styles.listContainer}>
            <View style={styles.rowItem}>
              <View style={styles.itemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: '#3b82f615' }]}>
                  <Ionicons name="home-outline" size={18} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.itemTitle}>Monthly Rent</Text>
                  <Text style={styles.itemSubtitle}>Due on 5th of every month</Text>
                </View>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemAmount}>₹8,000</Text>
                <Text style={[styles.dueDateText, { color: colors.success }]}>Paid (Jul)</Text>
              </View>
            </View>
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
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  listContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  dueDateText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});
