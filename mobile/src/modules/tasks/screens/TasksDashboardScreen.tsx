/**
 * TasksDashboardScreen — task manager root.
 *
 * Restyled to the Meridian v2 reference: a month header with a completion
 * ring, a week strip of day chips, TODAY / COMING UP sections and a red
 * "New task" button. Filtering, completion toggles, subtask counts and the
 * tap-through to the task detail all still work.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Chip,
  Label,
  PressScale,
  Ring,
  Rise,
  Screen,
} from '../../../shared/components/meridian';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import { useTasksStore, Task } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { TasksStackParamList } from '../../../navigation/RootNavigator';
import { processSyncQueue } from '../../../services/syncQueue';

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'TasksDashboard'>;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TasksDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { tasks, toggleTaskCompleted, purgeOldCompletedTasks } = useTasksStore();
  const { user } = useAuth();

  React.useEffect(() => {
    purgeOldCompletedTasks();
  }, []);

  useFocusEffect(
    useCallback(() => {
      processSyncQueue();
    }, [])
  );

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'done'>('all');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return mc.red;
      case 'high':
        return mc.amber;
      case 'medium':
        return mc.sky;
      default:
        return mc.textFaint;
    }
  };

  const getFilteredTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeTab) {
      case 'today':
        return tasks
          .filter((t) => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime() && !t.completed;
          })
          .sort((a, b) => {
            const order = { urgent: 0, high: 1, medium: 2, low: 3 };
            return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
          });
      case 'upcoming':
        return tasks
          .filter((t) => t.dueDate && new Date(t.dueDate) > today && !t.completed)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      case 'done':
        return tasks.filter((t) => t.completed).sort((a, b) => a.name.localeCompare(b.name));
      default:
        return tasks
          .filter((t) => !t.completed)
          .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime());
    }
  };

  const filteredList = getFilteredTasks();

  // ---- Today / coming up split ----
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const sections = useMemo(() => {
    if (activeTab === 'done') {
      return [{ title: 'COMPLETED', data: filteredList }];
    }
    if (activeTab === 'upcoming') {
      return [{ title: 'COMING UP', data: filteredList }];
    }
    const todayItems = filteredList.filter(
      (t) => t.dueDate && new Date(t.dueDate).getTime() < todayStart + 86400000
    );
    const laterItems = filteredList.filter(
      (t) => !t.dueDate || new Date(t.dueDate).getTime() >= todayStart + 86400000
    );
    const out: { title: string; data: Task[] }[] = [];
    if (todayItems.length) out.push({ title: 'TODAY', data: todayItems });
    if (laterItems.length) out.push({ title: 'COMING UP', data: laterItems });
    return out;
  }, [filteredList, activeTab, todayStart]);

  // ---- The week strip: the seven days around today ----
  const week = useMemo(() => {
    const out: { key: string; label: string; date: number; isToday: boolean; hasTasks: boolean; count: number }[] = [];
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = (monday.getDay() + 6) % 7; // Monday = 0
    monday.setDate(monday.getDate() - dow);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTasks = tasks.filter((t) => {
        if (!t.dueDate) return false;
        const td = new Date(t.dueDate);
        return (
          td.getFullYear() === d.getFullYear() &&
          td.getMonth() === d.getMonth() &&
          td.getDate() === d.getDate()
        );
      });
      out.push({
        key,
        label: WEEKDAYS[i],
        date: d.getDate(),
        isToday: i === dow,
        hasTasks: dayTasks.length > 0,
        count: dayTasks.length,
      });
    }
    return out;
  }, [tasks]);

  // ---- Today's completion ring ----
  const todayStats = useMemo(() => {
    const now = new Date();
    const todays = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
    const done = todays.filter((t) => t.completed).length;
    return { done, total: todays.length };
  }, [tasks]);

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const renderTaskItem = ({ item, index }: { item: Task; index: number }) => {
    const subtasks = item.subtasks || [];
    const completedSubtasks = subtasks.filter((st) => st.completed).length;
    const totalSubtasks = subtasks.length;
    const priorityColor = getPriorityColor(item.priority);

    return (
      <Rise index={index} step={40} distance={12}>
        <PressScale
          onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
          scale={0.99}
          style={styles.taskRow}
        >
          <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
          <PressScale
            onPress={() => toggleTaskCompleted(item.id, user?.id)}
            scale={0.9}
            style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
            accessibilityLabel={item.completed ? 'Mark as not done' : 'Mark as done'}
          >
            {item.completed ? <Ionicons name="checkmark" size={14} color={mc.ink} /> : null}
          </PressScale>
          <View style={styles.taskDetails}>
            <View style={styles.taskTitleRow}>
              <Text
                style={[styles.taskName, item.completed && styles.taskNameCompleted]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {!item.completed ? (
                <Chip
                  size="sm"
                  color={priorityColor}
                  style={styles.priorityTag}
                >
                  {item.priority}
                </Chip>
              ) : null}
            </View>
            {item.description ? (
              <Text style={styles.taskDesc} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={12} color={mc.textFaint} />
              <Text style={styles.metaText}>
                {new Date(item.dueDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
                {' '}
                {new Date(item.dueDate).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
              {totalSubtasks > 0 ? (
                <>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>
                    {completedSubtasks}/{totalSubtasks} subtasks
                  </Text>
                </>
              ) : null}
              {item.completed && item.completedAt ? (
                <>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>
                    {(() => {
                      const daysLeft = Math.ceil(
                        7 - (Date.now() - new Date(item.completedAt).getTime()) / 86400000
                      );
                      if (daysLeft <= 0) return 'Deleting soon';
                      return `${daysLeft}d till delete`;
                    })()}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={mc.textFaint} />
        </PressScale>
      </Rise>
    );
  };

  return (
    <Screen bottomInset={120}>
      {/* Header: month, title and the completion ring */}
      <Rise index={0}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Label small>{monthLabel.toUpperCase()}</Label>
            <Text style={styles.headerTitle}>Tasks</Text>
          </View>
          <Ring
            progress={todayStats.total > 0 ? todayStats.done / todayStats.total : 0}
            size={54}
            stroke={6}
            color={mc.mint}
          >
            <Text style={styles.ringText}>
              {todayStats.done}/{todayStats.total}
            </Text>
          </Ring>
        </View>
      </Rise>

      {/* Week strip */}
      <Rise index={1}>
        <View style={styles.weekRow}>
          {week.map((d) => (
            <View key={d.key} style={[styles.dayChip, d.isToday && styles.dayChipToday]}>
              <Text style={[styles.dayLabel, d.isToday && styles.dayLabelToday]}>{d.label}</Text>
              <Text style={[styles.dayNumber, d.isToday && styles.dayNumberToday]}>
                {d.date}
              </Text>
              {d.hasTasks ? (
                <View
                  style={[
                    styles.dayDot,
                    d.isToday ? styles.dayDotToday : { backgroundColor: mc.sky },
                  ]}
                />
              ) : (
                <View style={styles.dayDotSpacer} />
              )}
            </View>
          ))}
        </View>
      </Rise>

      {/* Filter tabs */}
      <Rise index={2}>
        <View style={styles.tabContainer}>
          {(['all', 'upcoming'] as const).map((t) => (
            <PressScale key={t} onPress={() => setActiveTab(t)} scale={0.96}>
              <View style={[styles.tabButton, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                  {t === 'all' ? 'Active' : 'Upcoming'}
                </Text>
              </View>
            </PressScale>
          ))}
          <PressScale
            onPress={() => setActiveTab(activeTab === 'done' ? 'all' : 'done')}
            scale={0.9}
            style={[styles.trashBtn, activeTab === 'done' && styles.trashBtnActive]}
            accessibilityLabel="Show completed tasks"
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={activeTab === 'done' ? mc.redSoft : mc.textDim}
            />
          </PressScale>
        </View>
      </Rise>

      {/* Task list */}
      <FlatList
        data={sections}
        keyExtractor={(s) => s.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkbox-outline" size={40} color={mc.textGhost} />
            <Text style={styles.emptyText}>No tasks found in this view</Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View>
            <Label style={styles.sectionTitle}>{section.title}</Label>
            {section.data.map((task, index) => (
              <View key={task.id}>{renderTaskItem({ item: task, index })}</View>
            ))}
          </View>
        )}
      />

      {/* New task button */}
      <Rise index={3}>
        <PressScale
          onPress={() => navigation.navigate('AddEditTask', {})}
          scale={0.96}
          style={styles.fab}
        >
          <Ionicons name="add" size={20} color={mc.white} />
          <Text style={styles.fabText}>New task</Text>
        </PressScale>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  ringText: {
    fontSize: 12,
    fontWeight: '500',
    color: mc.text,
  },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: mc.card,
  },
  dayChipToday: {
    backgroundColor: mc.red,
  },
  dayLabel: {
    fontSize: 11,
    color: mc.textDim,
  },
  dayLabelToday: {
    color: '#FFD0D6',
  },
  dayNumber: {
    fontSize: 17,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  dayNumberToday: {
    color: mc.white,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  dayDotToday: {
    backgroundColor: mc.white,
  },
  dayDotSpacer: {
    width: 4,
    height: 4,
    marginTop: 4,
  },

  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: mr.chip,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: mr.chip - 4,
  },
  tabActive: {
    backgroundColor: mc.red,
  },
  tabText: {
    fontSize: 14,
    color: mc.textDim,
  },
  tabTextActive: {
    color: mc.white,
    fontWeight: '600',
  },
  trashBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashBtnActive: {
    backgroundColor: mc.redDim,
  },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 8,
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 0,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.card,
    borderRadius: mr.row,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 10,
    marginBottom: 8,
  },
  priorityBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3A3A42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: mc.mint,
    borderColor: mc.mint,
  },
  taskDetails: {
    flex: 1,
    minWidth: 0,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskName: {
    flexShrink: 1,
    fontSize: 15,
    color: mc.text,
  },
  taskNameCompleted: {
    color: mc.textDim,
    textDecorationLine: 'line-through',
  },
  priorityTag: {
    marginLeft: 0,
  },
  taskDesc: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: mc.textDim,
  },
  metaDivider: {
    fontSize: 11,
    color: mc.textFaint,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: 10,
  },
  fab: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: mc.red,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.white,
  },
});
