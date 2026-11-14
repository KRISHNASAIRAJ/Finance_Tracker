/**
 * AddEditTaskScreen — form to create or edit a task with name, description,
 * priority, due date/time, recurrence, and subtasks.
 *
 * Restyled to the Meridian v2 reference (s20): a large title, flat fields,
 * priority/recurrence chip pickers and the primary red submit action.
 * All logic (store writes, reminder scheduling) is unchanged.
 */
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, alpha } from '../../../shared/theme/meridian';
import { Label, PressScale, Screen } from '../../../shared/components/meridian';
import { useTasksStore, RecurrenceType } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { TasksStackParamList } from '../../../navigation/RootNavigator';
import { scheduleAllReminders } from '../../../services/notificationService';
import CalendarPicker from '../../../shared/components/CalendarPicker';
import TimePicker from '../../../shared/components/TimePicker';

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'AddEditTask'>;
type RouteProps = RouteProp<TasksStackParamList, 'AddEditTask'>;

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
const RECURRENCES: { value: RecurrenceType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'none', label: 'None', icon: 'close-circle-outline' },
  { value: 'daily', label: 'Daily', icon: 'sunny-outline' },
  { value: 'weekdays', label: 'Mon to Fri', icon: 'briefcase-outline' },
  { value: 'weekly', label: 'Weekly', icon: 'calendar-outline' },
  { value: 'monthly', label: 'Monthly', icon: 'calendar-number-outline' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: mc.redSoft,
  high: mc.amber,
  medium: mc.sky,
  low: mc.textFaint,
};

export default function AddEditTaskScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { user } = useAuth();
  const { tasks, addTask, editTask } = useTasksStore();
  const taskId = route.params?.taskId;
  const isEditing = !!taskId;

  const existingTask = isEditing ? tasks.find((t) => t.id === taskId) : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeVisible, setTimeVisible] = useState(false);

  useEffect(() => {
    if (existingTask) {
      setName(existingTask.name);
      setDescription(existingTask.description || '');
      setPriority(existingTask.priority);
      setRecurrence(existingTask.recurrence);
      setLocalSubtasks(existingTask.subtasks.map((s) => s.name));
      setDueDate(new Date(existingTask.dueDate));
    }
  }, [existingTask]);

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

    if (isEditing && taskId) {
      editTask(taskId, {
        name: name.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate.toISOString(),
        subtasks: localSubtasks,
        recurrence,
      }, user?.id);
    } else {
      addTask({
        name: name.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate.toISOString(),
        subtasks: localSubtasks,
        recurrence,
      }, user?.id);
    }

    scheduleAllReminders(true);
    navigation.goBack();
  };

  return (
    <Screen scroll={false} bottomInset={0}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Large title */}
        <View style={styles.formHeader}>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit task' : 'Create task'}</Text>
          <Text style={styles.headerSubtitle}>Set priority, due time and repeat</Text>
        </View>

        <ScrollView
          style={styles.keyboardView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>TASK NAME</Label>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Clean the garage, Fix bug #42"
              placeholderTextColor={mc.textGhost}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Description */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>DESCRIPTION</Label>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add details, notes, links"
              placeholderTextColor={mc.textGhost}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Priority chips */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>PRIORITY</Label>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => {
                const color = PRIORITY_COLORS[p];
                const active = priority === p;
                return (
                  <PressScale
                    key={p}
                    onPress={() => setPriority(p)}
                    scale={0.95}
                    style={[
                      styles.chip,
                      active && { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.45) },
                    ]}
                    accessibilityLabel={`Priority ${p}`}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: color }]} />
                    <Text style={[styles.chipText, active && { color, fontWeight: '600' }]}>
                      {p.toUpperCase()}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </View>

          {/* Repeat chips */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>REPEAT</Label>
            <View style={styles.chipRow}>
              {RECURRENCES.map((r) => {
                const active = recurrence === r.value;
                return (
                  <PressScale
                    key={r.value}
                    onPress={() => setRecurrence(r.value)}
                    scale={0.95}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityLabel={`Repeat ${r.label}`}
                  >
                    <Ionicons name={r.icon} size={13} color={active ? mc.redSoft : mc.textDim} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </View>

          {/* Due date + time */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>DUE</Label>
            <View style={styles.dateTimeRow}>
              <PressScale
                style={styles.dateTrigger}
                wrapStyle={{ flex: 1.35 }}
                onPress={() => setCalendarVisible(true)}
                scale={0.98}
                accessibilityLabel="Choose date"
              >
                <Ionicons name="calendar-outline" size={17} color={mc.redSoft} />
                <Text style={styles.dateTriggerText}>
                  {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </PressScale>
              <PressScale
                style={styles.dateTrigger}
                wrapStyle={{ flex: 1 }}
                onPress={() => setTimeVisible(true)}
                scale={0.98}
                accessibilityLabel="Choose time"
              >
                <Ionicons name="time-outline" size={17} color={mc.redSoft} />
                <Text style={styles.dateTriggerText}>
                  {dueDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </PressScale>
            </View>
          </View>

          <CalendarPicker
            visible={calendarVisible}
            selected={dueDate}
            onSelect={setDueDate}
            onClose={() => setCalendarVisible(false)}
          />
          <TimePicker
            visible={timeVisible}
            selected={dueDate}
            onSelect={setDueDate}
            onClose={() => setTimeVisible(false)}
          />

          {/* Subtasks builder */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>SUBTASKS</Label>
            <View style={styles.subtaskBuilderRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Add subtask details"
                placeholderTextColor={mc.textGhost}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                onSubmitEditing={handleAddSubtask}
                returnKeyType="done"
              />
              <PressScale
                style={styles.subtaskAddBtn}
                onPress={handleAddSubtask}
                scale={0.92}
                accessibilityLabel="Add subtask"
              >
                <Ionicons name="add" size={22} color={mc.text} />
              </PressScale>
            </View>

            {localSubtasks.length > 0 && (
              <View style={styles.subtaskList}>
                {localSubtasks.map((st, index) => (
                  <View key={`${st}-${index}`} style={styles.subtaskRow}>
                    <Ionicons name="ellipse-outline" size={10} color={mc.redSoft} />
                    <Text style={styles.subtaskText} numberOfLines={1}>{st}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSubtask(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={mc.textFaint} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Actions */}
          <PressScale style={styles.submitButton} onPress={handleSubmit} scale={0.98} accessibilityLabel={isEditing ? 'Update task' : 'Create task'}>
            <Text style={styles.submitButtonText}>{isEditing ? 'Update task' : 'Create task'}</Text>
          </PressScale>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  formHeader: {
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingBottom: 40,
    gap: 16,
  },
  formSection: {
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 4,
  },
  textInput: {
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: mc.text,
  },
  textArea: {
    minHeight: 72,
    paddingTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.raised,
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: mc.redDim,
    borderColor: alpha(mc.redSoft, 0.4),
  },
  chipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  chipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateTriggerText: {
    fontSize: 14,
    color: mc.text,
  },
  subtaskBuilderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtaskAddBtn: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskList: {
    gap: 6,
    marginTop: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.card,
    borderRadius: mr.row,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subtaskText: {
    flex: 1,
    fontSize: 14,
    color: mc.text,
  },
  submitButton: {
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.white,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: mc.textDim,
  },
});
