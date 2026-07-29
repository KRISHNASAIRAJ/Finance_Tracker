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
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore, InvestmentGoal } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { queueGoalSync } from '../hooks/useEquitySync';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type RouteParams = {
  AddEditGoal: { goalId?: string } | undefined;
};

const PRIORITIES: InvestmentGoal['priority'][] = ['low', 'medium', 'high'];

export default function AddEditGoalScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'AddEditGoal'>>();
  const { user } = useAuth();
  const goalId = route.params?.goalId;
  const existing = goalId
    ? useInvestmentsStore((s) => s.goals.find((g) => g.id === goalId))
    : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing ? String(existing.target / 100) : '');
  const [current, setCurrent] = useState(existing ? String(existing.current / 100) : '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ? new Date(existing.dueDate) : new Date());
  const [priority, setPriority] = useState<InvestmentGoal['priority']>(existing?.priority ?? 'medium');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Goal name is required.');
      return;
    }
    const targetPaise = target ? Math.round(parseFloat(target) * 100) : 0;
    const currentPaise = current ? Math.round(parseFloat(current) * 100) : 0;

    if (isNaN(targetPaise) || isNaN(currentPaise)) {
      Alert.alert('Invalid numbers', 'Amounts must be valid numbers.');
      return;
    }

    const store = useInvestmentsStore.getState();

    if (isEdit && goalId) {
      store.updateGoal(goalId, {
        name: name.trim(),
        target: targetPaise,
        current: currentPaise,
        dueDate: dueDate.toISOString(),
        priority,
      });
      if (user) {
        queueGoalSync(user.id, 'update', {
          id: goalId,
          name: name.trim(),
          target: targetPaise,
          current: currentPaise,
          dueDate: dueDate.toISOString(),
          priority,
        });
      }
    } else {
      const id = store.addGoal({
        name: name.trim(),
        target: targetPaise,
        current: currentPaise,
        dueDate: dueDate.toISOString(),
        priority,
      });
      if (user) {
        queueGoalSync(user.id, 'create', {
          id,
          name: name.trim(),
          target: targetPaise,
          current: currentPaise,
          dueDate: dueDate.toISOString(),
          priority,
        });
      }
    }

    navigation.goBack();
  };

  const handleDelete = () => {
    if (!goalId) return;
    Alert.alert('Delete Goal', `Remove "${existing?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          useInvestmentsStore.getState().deleteGoal(goalId);
          if (user) queueGoalSync(user.id, 'delete', { id: goalId });
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Goal Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Retirement Fund 2045"
          placeholderTextColor={colors.outline}
        />

        <Text style={styles.label}>Target Amount (₹)</Text>
        <TextInput
          style={styles.input}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.outline}
        />

        <Text style={styles.label}>Current Progress (₹)</Text>
        <TextInput
          style={styles.input}
          value={current}
          onChangeText={setCurrent}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.outline}
        />

        <Text style={styles.label}>Target Date</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[styles.dateText, !dueDate && { color: colors.outline }]}>
            {dueDate ? dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Select date'}
          </Text>
        </TouchableOpacity>

        <CalendarPicker
          visible={showDatePicker}
          selected={dueDate}
          onSelect={(d) => { setDueDate(d); setShowDatePicker(false); }}
          onClose={() => setShowDatePicker(false)}
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
              onPress={() => setPriority(p)}
            >
              <Text style={[styles.priorityBtnText, priority === p && styles.priorityBtnTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>{isEdit ? 'Update Goal' : 'Add Goal'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete Goal</Text>
          </TouchableOpacity>
        )}
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
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 12,
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: -6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  priorityBtnActive: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
  },
  priorityBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  priorityBtnTextActive: {
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.error}30`,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
});
