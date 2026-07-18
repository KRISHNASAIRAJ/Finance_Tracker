import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FinanceStackParamList } from '../../navigation/RootNavigator';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';

type NavProp = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

interface Action {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
  route: keyof FinanceStackParamList;
}

const ACTIONS: Action[] = [
  {
    icon: 'add-circle-outline',
    label: 'Add Expense',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    route: 'AddExpense',
  },
  {
    icon: 'cash-outline',
    label: 'This Month',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.12)',
    route: 'MonthlySpend',
  },
  {
    icon: 'alarm-outline',
    label: 'Due This Week',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    route: 'FixedExpenses',
  },
  {
    icon: 'trending-up-outline',
    label: 'Investments',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.12)',
    route: 'FinanceReports',
  },
];

export default function QuickActionsWidget() {
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={[styles.cell, { backgroundColor: action.bg }]}
            onPress={() => navigation.navigate(action.route as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${action.color}25` }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={[styles.label, { color: action.color }]} numberOfLines={2}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: rounded.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    minHeight: 90,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
