/**
 * TaskDetailScreen — full task view with subtasks, completion toggle, delete,
 * and notification scheduling.
 *
 * Restyled to the Meridian v2 reference (s19): back bar with edit/delete, a
 * priority chip + mark-complete chip, a tinted task card with the due row
 * and the subtasks checklist (including the inline add-subtask field).
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, alpha } from '../../../shared/theme/meridian';
import { Card, Chip, EmptyState, IconTile, Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useTasksStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { TasksStackParamList } from '../../../navigation/RootNavigator';
import { scheduleAllReminders } from '../../../services/notificationService';

type TaskDetailRouteProp = RouteProp<TasksStackParamList, 'TaskDetail'>;
type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'TaskDetail'>;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: mc.redSoft,
  high: mc.amber,
  medium: mc.sky,
  low: mc.textDim,
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function TaskDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TaskDetailRouteProp>();
  const { taskId } = route.params;
  const { user } = useAuth();

  const { tasks, toggleSubtaskCompleted, toggleTaskCompleted, deleteTask, editTask } = useTasksStore();
  const task = tasks.find((t) => t.id === taskId);
  const [subtaskInput, setSubtaskInput] = useState('');

  if (!task) {
    return (
      <Screen scroll={false} bottomInset={0}>
        <TopBar title="Task details" onBack={() => navigation.goBack()} variant="center" />
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Task not found</Text>
        </View>
      </Screen>
    );
  }

  const priorityColor = PRIORITY_COLORS[task.priority] ?? mc.textDim;
  const completedCount = task.subtasks.filter((st) => st.completed).length;

  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const overdue = !task.completed && dueDate.getTime() < now.getTime() && !isSameDay(dueDate, now);
  const dueChip = task.completed
    ? 'Done'
    : isSameDay(dueDate, now)
      ? 'Today'
      : isSameDay(dueDate, tomorrow)
        ? 'Tomorrow'
        : overdue
          ? 'Overdue'
          : null;
  const dueChipColor = task.completed ? mc.mint : isSameDay(dueDate, now) ? mc.redSoft : overdue ? mc.redSoft : mc.amber;
  const dueChipDim = task.completed ? mc.mintDim : dueChipColor === mc.amber ? mc.amberDim : mc.redDim;

  const handleDelete = () => {
    Alert.alert('Delete task', `Delete "${task.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id, user?.id);
          scheduleAllReminders(true);
          setTimeout(() => navigation.goBack(), 50);
        },
      },
    ]);
  };

  const handleAddSubtask = () => {
    const name = subtaskInput.trim();
    if (!name) return;
    editTask(
      task.id,
      {
        name: task.name,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        subtasks: [...task.subtasks.map((st) => st.name), name],
        recurrence: task.recurrence,
      },
      user?.id
    );
    setSubtaskInput('');
  };

  return (
    <Screen bottomInset={36}>
      <TopBar
        title="Task details"
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <View style={styles.topBarActions}>
            <PressScale
              style={styles.circleBtn}
              onPress={() => navigation.navigate('AddEditTask', { taskId: task.id })}
              scale={0.92}
              accessibilityLabel="Edit task"
            >
              <Ionicons name="pencil" size={17} color={mc.text} />
            </PressScale>
            <PressScale
              style={styles.circleBtn}
              onPress={handleDelete}
              scale={0.92}
              accessibilityLabel="Delete task"
            >
              <Ionicons name="trash-outline" size={18} color={mc.redSoft} />
            </PressScale>
          </View>
        }
      />

      {/* Priority + completion chips */}
      <View style={styles.metaRow}>
        <Chip icon="ellipse" color={priorityColor} size="md" style={styles.metaChip}>
          {task.priority.toUpperCase()}
        </Chip>
        <PressScale
          onPress={() => toggleTaskCompleted(task.id, user?.id)}
          scale={0.96}
          style={[styles.completeChip, { backgroundColor: task.completed ? mc.mintDim : mc.mintDim }]}
          accessibilityLabel={task.completed ? 'Mark as not complete' : 'Mark complete'}
        >
          <Ionicons name="checkmark" size={14} color={mc.mint} />
          <Text style={styles.completeChipText}>
            {task.completed ? 'Completed' : 'Mark complete'}
          </Text>
        </PressScale>
      </View>

      {/* Task info card — deep red tint, the "attention" panel */}
      <Card tone="red">
        <Text style={styles.taskName}>{task.name}</Text>
        {task.description ? (
          <Text style={styles.taskDesc}>{task.description}</Text>
        ) : (
          <Text style={styles.taskDescEmpty}>No description added</Text>
        )}

        <View style={styles.taskDivider} />

        <View style={styles.infoRow}>
          <IconTile icon="calendar-outline" color={mc.redSoft} background={mc.redDim} size={34} />
          <View style={styles.infoMain}>
            <Text style={styles.infoLabel}>Due</Text>
            <Text style={styles.infoValue}>
              {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {dueDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          {dueChip ? (
            <View style={[styles.dueChip, { backgroundColor: dueChipDim }]}>
              <Text style={[styles.dueChipText, { color: dueChipColor }]}>{dueChip}</Text>
            </View>
          ) : null}
        </View>

        {task.recurrence && task.recurrence !== 'none' && (
          <View style={[styles.infoRow, styles.recurrenceRow]}>
            <IconTile icon="repeat-outline" color={mc.violet} background={mc.violetDim} size={34} />
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>Repeat</Text>
              <Text style={styles.infoValue}>
                {task.recurrence === 'weekdays'
                  ? 'Mon-Fri'
                  : task.recurrence.charAt(0).toUpperCase() + task.recurrence.slice(1)}
              </Text>
            </View>
          </View>
        )}
      </Card>

      {/* Subtasks */}
      <Card>
        <View style={styles.subtasksHeader}>
          <Label>SUBTASKS</Label>
          <Text style={styles.subtasksCount}>
            {completedCount} of {task.subtasks.length}
          </Text>
        </View>

        {task.subtasks.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="No subtasks yet"
            subtitle="Break the task into smaller pieces"
          />
        ) : (
          <View style={styles.subtaskList}>
            {task.subtasks.map((st) => (
              <TouchableOpacity
                key={st.id}
                style={styles.subtaskRow}
                onPress={() => toggleSubtaskCompleted(task.id, st.id, user?.id)}
                activeOpacity={0.7}
                accessibilityLabel={`Toggle subtask ${st.name}`}
              >
                <View style={[styles.subtaskCheck, st.completed && styles.subtaskCheckDone]}>
                  {st.completed ? <Ionicons name="checkmark" size={13} color={mc.ink} /> : null}
                </View>
                <Text style={[styles.subtaskName, st.completed && styles.subtaskNameDone]}>
                  {st.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add a subtask */}
        <View style={styles.addSubtaskRow}>
          <TextInput
            style={styles.subtaskInput}
            placeholder="Add a subtask"
            placeholderTextColor={mc.textGhost}
            value={subtaskInput}
            onChangeText={setSubtaskInput}
            onSubmitEditing={handleAddSubtask}
            returnKeyType="done"
          />
          <PressScale
            style={styles.addSubtaskBtn}
            onPress={handleAddSubtask}
            scale={0.92}
            accessibilityLabel="Add subtask"
          >
            <Ionicons name="add" size={17} color={mc.white} />
          </PressScale>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: mc.textDim,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metaChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: mr.chip,
  },
  completeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: mr.chip,
  },
  completeChipText: {
    fontSize: 13,
    color: mc.mint,
    fontWeight: '600',
  },
  taskName: {
    fontSize: 24,
    fontWeight: '500',
    color: mc.text,
  },
  taskDesc: {
    fontSize: 13,
    color: mc.textDim,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 19,
  },
  taskDescEmpty: {
    fontSize: 13,
    color: mc.textFaint,
    fontStyle: 'italic',
    marginTop: 6,
  },
  taskDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha('#FF4D66', 0.16),
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recurrenceRow: {
    marginTop: 12,
  },
  infoMain: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: 11,
    color: mc.textDim,
  },
  infoValue: {
    fontSize: 15,
    color: mc.text,
    marginTop: 1,
  },
  dueChip: {
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  dueChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subtasksCount: {
    fontSize: 12,
    color: mc.textDim,
  },
  subtaskList: {
    gap: 4,
    marginBottom: 10,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  subtaskCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: mc.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCheckDone: {
    backgroundColor: mc.mint,
    borderColor: mc.mint,
  },
  subtaskName: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
  },
  subtaskNameDone: {
    color: mc.textDim,
    textDecorationLine: 'line-through',
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingLeft: 14,
    paddingVertical: 6,
    paddingRight: 6,
    marginTop: 4,
  },
  subtaskInput: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
    paddingVertical: 10,
  },
  addSubtaskBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
