import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { usePersonalStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { queueGoalSync } from '../hooks/usePersonalSync';

export default function GoalsTrackerScreen() {
  const navigation = useNavigation();
  const { goals, toggleGoal, addGoal, deleteGoal } = usePersonalStore();
  const { user } = useAuth();
  const [goalInput, setGoalInput] = useState('');

  const handleAddGoal = () => {
    if (!goalInput.trim()) return;
    const goal = addGoal(goalInput.trim());
    setGoalInput('');
    if (user) queueGoalSync(user.id, 'create', goal);
  };

  const completedCount = goals.filter((g) => g.completed).length;
  const progressPercent = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>2026 Goals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.progressTitle}>Annual Milestones Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {completedCount} of {goals.length} goals completed
          </Text>
        </View>

        {/* Creator Input */}
        <View style={styles.addSection}>
          <TextInput
            style={styles.textInput}
            placeholder="Add new 2026 goal milestone..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={goalInput}
            onChangeText={setGoalInput}
            onSubmitEditing={handleAddGoal}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddGoal}>
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Goals List */}
        <View style={styles.listCard}>
          {goals.map((g) => (
            <View key={g.id} style={styles.goalRow}>
              <TouchableOpacity
                style={styles.goalLeft}
                onPress={() => {
                  toggleGoal(g.id);
                  const updated = goals.find((x) => x.id === g.id);
                  if (user && updated) queueGoalSync(user.id, 'update', { ...updated, completed: !updated.completed });
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, g.completed && styles.checkboxCompleted]}>
                  {g.completed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                </View>
                <Text style={[styles.goalName, g.completed && styles.goalNameCompleted]}>
                  {g.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  const doDelete = () => { deleteGoal(g.id); if (user) queueGoalSync(user.id, 'delete', g); };
                  if (Platform.OS === 'ios') {
                    doDelete();
                  } else {
                    import('react-native').then(({ Alert }) => {
                      Alert.alert('Delete Goal', `Remove "${g.name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: doDelete },
                      ]);
                    });
                  }
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
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
  progressCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: rounded.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: rounded.full,
  },
  progressText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  addSection: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.primaryContainer,
    width: 48,
    height: 48,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  goalName: {
    fontSize: 14,
    color: colors.onSurface,
    fontWeight: '500',
  },
  goalNameCompleted: {
    textDecorationLine: 'line-through',
    color: colors.onSurfaceVariant,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
