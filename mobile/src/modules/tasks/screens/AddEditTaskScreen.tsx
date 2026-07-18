import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useTasksStore } from '../store';
import { TasksStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'AddEditTask'>;

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

export default function AddEditTaskScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { addTask } = useTasksStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([]);
  const [daysOffset, setDaysOffset] = useState('1'); // Days from today default

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setLocalSubtasks([...localSubtasks, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (index: number) => {
    setLocalSubtasks(localSubtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Please enter a task name');
      return;
    }

    const offset = parseInt(daysOffset, 10);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (isNaN(offset) ? 1 : offset));

    addTask({
      name: name.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate.toISOString(),
      subtasks: localSubtasks,
    });

    navigation.goBack();
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent':
        return colors.error;
      case 'high':
        return '#f59e0b';
      case 'medium':
        return colors.primary;
      default:
        return colors.outline;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.headerTitle}>Create Task</Text>
            <Text style={styles.headerSubtitle}>Set priorities and milestones</Text>
          </View>

          {/* Name & Desc */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>TASK NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Clean the garage, Fix bug #42"
              placeholderTextColor={colors.onSurfaceVariant}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add details, notes, links..."
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Priority Select */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>PRIORITY LEVEL</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const isSelected = priority === p;
                const dotColor = getPriorityColor(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      isSelected && { backgroundColor: `${dotColor}25`, borderColor: dotColor },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: dotColor }]} />
                    <Text style={[styles.priorityText, isSelected && { color: '#ffffff', fontWeight: 'bold' }]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Due date relative offset */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>DUE DATE (DAYS FROM TODAY)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 1 (tomorrow), 7 (next week)"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="number-pad"
              value={daysOffset}
              onChangeText={setDaysOffset}
            />
          </View>

          {/* Subtasks Builder */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>SUBTASKS (CHECKLIST)</Text>
            <View style={styles.subtaskBuilderRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Add subtask details..."
                placeholderTextColor={colors.onSurfaceVariant}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                onSubmitEditing={handleAddSubtask}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddSubtask}>
                <Ionicons name="add" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {localSubtasks.length > 0 ? (
              <View style={styles.subtaskList}>
                {localSubtasks.map((st, index) => (
                  <View key={index} style={styles.subtaskRow}>
                    <View style={styles.subtaskLeft}>
                      <Ionicons name="ellipse-outline" size={12} color={colors.primary} />
                      <Text style={styles.subtaskText}>{st}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveSubtask(index)}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Create Task</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
  },
  formHeader: {
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  formSection: {
    gap: spacing.stackGapSm,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rounded.full,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: rounded.full,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  subtaskBuilderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    backgroundColor: colors.primaryContainer,
    width: 48,
    height: 48,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskList: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    marginTop: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  subtaskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  subtaskText: {
    fontSize: 13,
    color: colors.onSurface,
  },
  buttonContainer: {
    gap: spacing.stackGapSm,
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
});
