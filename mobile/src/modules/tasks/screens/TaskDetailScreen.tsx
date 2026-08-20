/**
 * TaskDetailScreen — full task view with subtasks, completion toggle, delete,
 * and notification scheduling.
 */
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useTasksStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { TasksStackParamList } from '../../../navigation/RootNavigator';
import { scheduleAllReminders } from '../../../services/notificationService';

type TaskDetailRouteProp = RouteProp<TasksStackParamList, 'TaskDetail'>;
type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'TaskDetail'>;

export default function TaskDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TaskDetailRouteProp>();
  const { taskId } = route.params;
  const { user } = useAuth();

  const { tasks, toggleSubtaskCompleted, toggleTaskCompleted, deleteTask } = useTasksStore();
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Task not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    deleteTask(task.id, user?.id);
    scheduleAllReminders();
    setTimeout(() => navigation.goBack(), 50);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return colors.error;
      case 'high':
        return colors.warning;
      case 'medium':
        return colors.primary;
      default:
        return colors.outline;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Task Details</Text>
        <View style={styles.appBarActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('AddEditTask', { taskId: task.id })}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Priority and Status Badges */}
        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { borderColor: getPriorityColor(task.priority) }]}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
            <Text style={[styles.metaText, { color: getPriorityColor(task.priority) }]}>
              {task.priority.toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.statusBadge, task.completed && styles.statusBadgeCompleted]}
            onPress={() => toggleTaskCompleted(task.id, user?.id)}
          >
            <Text style={[styles.statusText, task.completed && styles.statusTextCompleted]}>
              {task.completed ? 'COMPLETED' : 'MARK COMPLETE'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task Info */}
        <View style={styles.detailsCard}>
          <Text style={styles.taskName}>{task.name}</Text>
          {task.description ? (
            <Text style={styles.taskDesc}>{task.description}</Text>
          ) : (
            <Text style={styles.taskDescEmpty}>No description added</Text>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Due:{' '}
              <Text style={styles.infoHighlight}>
                {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </Text>
          </View>

          {task.recurrence && task.recurrence !== 'none' && (
            <View style={styles.infoRow}>
              <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                Recurrence:{' '}
                <Text style={styles.infoHighlight}>
                  {task.recurrence === 'weekdays'
                    ? 'Mon-Fri'
                    : task.recurrence.charAt(0).toUpperCase() + task.recurrence.slice(1)}
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* Subtask Section */}
        <View style={styles.subtasksSection}>
          <Text style={styles.sectionTitle}>SUBTASKS / CHECKLIST</Text>
          <View style={styles.subtaskContainer}>
            {task.subtasks.length === 0 ? (
              <View style={styles.emptySubtasks}>
                <Text style={styles.emptySubtaskText}>No subtasks added for this task</Text>
              </View>
            ) : (
              task.subtasks.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={styles.subtaskRow}
                    onPress={() => toggleSubtaskCompleted(task.id, st.id, user?.id)}
                    activeOpacity={0.8}
                  >
                  <View style={[styles.subtaskCheckbox, st.completed && styles.subtaskCheckboxCompleted]}>
                    {st.completed && <Ionicons name="checkmark" size={12} color={colors.onSurface} />}
                  </View>
                  <Text style={[styles.subtaskName, st.completed && styles.subtaskNameCompleted]}>
                    {st.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
  appBarActions: {
    flexDirection: 'row',
    gap: 4,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
  },
  backButtonText: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rounded.full,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: rounded.full,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rounded.full,
    justifyContent: 'center',
  },
  statusBadgeCompleted: {
    backgroundColor: colors.successContainer,
    borderColor: colors.border,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusTextCompleted: {
    color: colors.success,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 12,
  },
  taskName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  taskDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  taskDescEmpty: {
    fontSize: 14,
    color: colors.outline,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoHighlight: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  subtasksSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  subtaskContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subtaskCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCheckboxCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subtaskName: {
    fontSize: 14,
    color: colors.onSurface,
  },
  subtaskNameCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  emptySubtasks: {
    padding: 24,
    alignItems: 'center',
  },
  emptySubtaskText: {
    fontSize: 13,
    color: colors.outline,
  },
});
