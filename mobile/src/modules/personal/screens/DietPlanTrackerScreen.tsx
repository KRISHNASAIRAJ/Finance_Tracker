import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { usePersonalStore } from '../store';

export default function DietPlanTrackerScreen() {
  const navigation = useNavigation();
  const { meals } = usePersonalStore();

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);

  const activePlan = meals.find((m) => m.day === selectedDay) || meals[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Diet Planner</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Day Selector Scroll */}
      <View style={styles.daySelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                  {day.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>{selectedDay}'s Nutrition Plan</Text>

        {/* Meal Slots Grids */}
        <View style={styles.slotsContainer}>
          {/* Breakfast */}
          <View style={styles.mealSlotCard}>
            <View style={styles.slotHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="sunny-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.slotTitle}>Breakfast</Text>
            </View>
            <Text style={styles.mealName}>{activePlan.breakfast}</Text>
          </View>

          {/* Lunch */}
          <View style={styles.mealSlotCard}>
            <View style={styles.slotHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="restaurant-outline" size={18} color="#f59e0b" />
              </View>
              <Text style={styles.slotTitle}>Lunch</Text>
            </View>
            <Text style={styles.mealName}>{activePlan.lunch}</Text>
          </View>

          {/* Dinner */}
          <View style={styles.mealSlotCard}>
            <View style={styles.slotHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: '#3b82f620' }]}>
                <Ionicons name="moon-outline" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.slotTitle}>Dinner</Text>
            </View>
            <Text style={styles.mealName}>{activePlan.dinner}</Text>
          </View>

          {/* Snack */}
          <View style={styles.mealSlotCard}>
            <View style={styles.slotHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: `${colors.success}15` }]}>
                <Ionicons name="nutrition-outline" size={18} color={colors.success} />
              </View>
              <Text style={styles.slotTitle}>Snack</Text>
            </View>
            <Text style={styles.mealName}>{activePlan.snack}</Text>
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
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  daySelectorContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  dayScroll: {
    paddingHorizontal: spacing.containerPadding,
    gap: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  dayButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  dayTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  slotsContainer: {
    gap: 12,
  },
  mealSlotCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    paddingLeft: 42,
  },
});
