import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';

const GOAL_OPTIONS = [
  { id: 'Finance', label: 'Finance', icon: 'wallet-outline' },
  { id: 'Garage', label: 'Garage', icon: 'speedometer-outline' },
  { id: 'Health', label: 'Health', icon: 'heart-outline' },
  { id: 'Tasks', label: 'Tasks', icon: 'checkbox-outline' },
];

export default function GoalSelectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { name } = route.params || { name: 'User' };
  
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selectedGoals.length >= 2) {
      navigation.navigate('IdentityDetails', { name, goals: selectedGoals });
    }
  };

  const isEnabled = selectedGoals.length >= 2;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Goals</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '50%' }]} />
          </View>
        </View>

        {/* Prompts */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>What are your goals?</Text>
          <Text style={styles.subtitle}>Select at least two categories to track.</Text>
        </View>

        {/* Goals Grid */}
        <View style={styles.grid}>
          {GOAL_OPTIONS.map((item) => {
            const isSelected = selectedGoals.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.8}
                onPress={() => toggleGoal(item.id)}
              >
                <View style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
                  <Ionicons
                    name={item.icon as any}
                    size={32}
                    color={isSelected ? colors.onSurface : colors.onSurfaceVariant}
                  />
                </View>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {item.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.button, !isEnabled && styles.buttonDisabled]}
          activeOpacity={0.85}
          disabled={!isEnabled}
          onPress={handleContinue}
        >
          <Text style={[styles.buttonText, !isEnabled && styles.buttonTextDisabled]}>Continue</Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={isEnabled ? colors.onSurface : colors.outline}
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerPadding,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.containerPadding * 1.5,
    paddingBottom: 40,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    opacity: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconWrapperSelected: {
    backgroundColor: colors.primary,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  cardLabelSelected: {
    color: colors.onSurface,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  button: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.surface,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  buttonTextDisabled: {
    color: colors.outline,
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
