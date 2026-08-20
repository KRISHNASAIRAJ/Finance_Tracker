/**
 * ExpenseConfirmationScreen — post-add confirmation summary for a transaction
 * with details and next steps.
 */
import React from 'react';
import {
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

export default function ExpenseConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { transactionId } = route.params;

  const { transactions } = useFinanceStore();
  const tx = transactions.find((t) => t.id === transactionId);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animated Checkmark Icon Wrapper */}
        <View style={styles.successIconWrapper}>
          <Ionicons name="checkmark-circle" size={80} color={colors.success} />
        </View>

        <Text style={styles.title}>Expense Logged</Text>
        <Text style={styles.subtitle}>Added successfully to transactions ledger</Text>

        {/* Expense Card summary */}
        {tx ? (
          <View style={styles.summaryCard}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>AMOUNT</Text>
              <Text style={styles.amountValue}>{formatCurrency(tx.amount)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowItem}>
              <Text style={styles.label}>DESCRIPTION</Text>
              <Text style={styles.detailValue}>{tx.notes || tx.category}</Text>
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>DETECTED CATEGORY</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tx.category.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>METHOD</Text>
              <Text style={styles.detailValue}>Cash/Auto</Text>
            </View>
          </View>
        ) : null}

        {/* Done CTA */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.navigate('FinanceHome')}
          activeOpacity={0.8}
        >
          <Text style={styles.doneText}>Back to Dashboard</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  successIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.successContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 14,
    marginBottom: 24,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  badge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
    borderColor: `${colors.primary}30`,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  doneText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
