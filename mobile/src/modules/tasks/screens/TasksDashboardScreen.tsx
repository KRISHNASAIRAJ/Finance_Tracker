import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useTasksStore, Task } from '../store';
import { TasksStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<TasksStackParamList, 'TasksDashboard'>;

export default function TasksDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { tasks, toggleTaskCompleted } = useTasksStore();

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'done'>('all');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  const renderTaskItem = ({ item }: { item: Task }) => {
    const subtasks = item.subtasks || [];
    const completedSubtasks = subtasks.filter((st) => st.completed).length;
    const totalSubtasks = subtasks.length;

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.taskCardRow}>
          <TouchableOpacity
            style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
            onPress={() => toggleTaskCompleted(item.id)}
          >
            {item.completed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
          </TouchableOpacity>
          <View style={styles.taskDetails}>
            <Text style={[styles.taskName, item.completed && styles.taskNameCompleted]}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.taskDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
              <Text style={styles.metaText}>{item.priority.toUpperCase()}</Text>
              <Text style={styles.metaDivider}>·</Text>
              <Text style={styles.metaText}>
                {new Date(item.dueDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
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
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.outline} />
      </TouchableOpacity>
    );
  };

  const filteredList = getFilteredTasks();

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter Tabs Segment */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabActive]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'done' && styles.tabActive]}
          onPress={() => setActiveTab('done')}
        >
          <Text style={[styles.tabText, activeTab === 'done' && styles.tabTextActive]}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredList}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkbox-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No tasks found in this view</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditTask', {})}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 4,
    marginHorizontal: spacing.containerPadding,
    marginVertical: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  tabActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onSurface,
  },
  listContent: {
    paddingHorizontal: spacing.containerPadding,
    paddingBottom: 100,
    gap: 12,
  },
  taskCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
  },
  taskCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskDetails: {
    flex: 1,
    gap: 4,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  taskNameCompleted: {
    textDecorationLine: 'line-through',
    color: colors.onSurfaceVariant,
  },
  taskDesc: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: rounded.full,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  metaDivider: {
    fontSize: 10,
    color: colors.outline,
  },
  emptyState: {
    padding: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
});
