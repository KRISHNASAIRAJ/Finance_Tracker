/**
 * WeeklyDiaryScreen — Weekly reflection diary with week navigation and autosave.
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useDiaryStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

function getWeekDates(weekYear: number, weekNumber: number): { start: Date; end: Date } {
  const jan1 = new Date(weekYear, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + daysOffset - jan1.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export default function WeeklyDiaryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { entries, addEntry, updateEntry, deleteEntry } = useDiaryStore();

  const now = new Date();
  const currentWeekYear = now.getFullYear();
  const currentWeek = getWeekNumber(now);

  const [selectedWeekYear, setSelectedWeekYear] = useState(currentWeekYear);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const currentEntry = useMemo(
    () => entries.find((e) => e.weekYear === selectedWeekYear && e.weekNumber === selectedWeek),
    [entries, selectedWeekYear, selectedWeek]
  );

  useFocusEffect(
    useCallback(() => {
      if (currentEntry) {
        setContent(currentEntry.content);
      } else {
        setContent('');
      }
      setIsEditing(false);
    }, [currentEntry?.id])
  );

  const { start, end } = getWeekDates(selectedWeekYear, selectedWeek);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const weekLabel = `Week ${selectedWeek}, ${selectedWeekYear}`;
  const dateRange = `${formatDate(start)} – ${formatDate(end)}`;

  const goToPrevWeek = () => {
    if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    } else {
      setSelectedWeekYear(selectedWeekYear - 1);
      setSelectedWeek(52);
    }
  };

  const goToNextWeek = () => {
    if (selectedWeekYear === currentWeekYear && selectedWeek === currentWeek) return;
    const dec31 = new Date(selectedWeekYear, 11, 31);
    const maxWeek = getWeekNumber(dec31);
    if (selectedWeek < maxWeek) {
      setSelectedWeek(selectedWeek + 1);
    } else {
      setSelectedWeekYear(selectedWeekYear + 1);
      setSelectedWeek(1);
    }
  };

  const handleSave = () => {
    if (!content.trim()) return;
    if (currentEntry) {
      updateEntry(currentEntry.id, content.trim(), user?.id);
    } else {
      addEntry(selectedWeekYear, selectedWeek, content.trim(), user?.id);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (currentEntry) {
      deleteEntry(currentEntry.id, user?.id);
      setContent('');
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    if (currentEntry) {
      setContent(currentEntry.content);
    }
    setIsEditing(true);
  };

  const weeksWithEntries = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(`${e.weekYear}-${e.weekNumber}`);
    }
    return set;
  }, [entries]);

  const hasEntry = weeksWithEntries.has(`${selectedWeekYear}-${selectedWeek}`);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Weekly Diary</Text>
        <View style={styles.appBarRight}>
          {hasEntry && !isEditing && (
            <TouchableOpacity style={styles.iconButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {isEditing && hasEntry && (
            <TouchableOpacity style={styles.iconButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={goToPrevWeek} style={styles.weekNavBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.weekInfo}>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
              <Text style={styles.dateRange}>{dateRange}</Text>
              {hasEntry && !isEditing && (
                <View style={styles.filledBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.filledBadgeText}>Filled</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={goToNextWeek}
              style={[
                styles.weekNavBtn,
                selectedWeekYear === currentWeekYear && selectedWeek === currentWeek && styles.weekNavBtnDisabled,
              ]}
              disabled={selectedWeekYear === currentWeekYear && selectedWeek === currentWeek}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  selectedWeekYear === currentWeekYear && selectedWeek === currentWeek
                    ? colors.outline
                    : colors.primary
                }
              />
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <>
              <TextInput
                style={styles.textArea}
                placeholder="What happened this week? Write your thoughts, achievements, struggles..."
                placeholderTextColor={colors.outline}
                multiline
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                autoFocus
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={() => {
                    setIsEditing(false);
                    setContent(currentEntry?.content || '');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                  <Ionicons name="save-outline" size={18} color={colors.onSurface} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : hasEntry ? (
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{currentEntry?.content}</Text>
              <Text style={styles.updatedText}>
                Last updated: {currentEntry?.updatedAt ? new Date(currentEntry.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color={colors.outline} />
              <Text style={styles.emptyTitle}>No entry for this week</Text>
              <Text style={styles.emptySubtitle}>Start journaling your weekly reflections</Text>
              <TouchableOpacity style={styles.startBtn} onPress={handleEdit}>
                <Ionicons name="add" size={20} color={colors.onSurface} />
                <Text style={styles.startBtnText}>Write Entry</Text>
              </TouchableOpacity>
            </View>
          )}

          {entries.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Previous Entries</Text>
              {entries
                .sort((a, b) => {
                  if (a.weekYear !== b.weekYear) return b.weekYear - a.weekYear;
                  return b.weekNumber - a.weekNumber;
                })
                .slice(0, 10)
                .map((entry) => {
                  const d = getWeekDates(entry.weekYear, entry.weekNumber);
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.historyCard}
                      onPress={() => {
                        setSelectedWeekYear(entry.weekYear);
                        setSelectedWeek(entry.weekNumber);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyLeft}>
                        <Ionicons name="book-outline" size={18} color={colors.primary} />
                        <View>
                          <Text style={styles.historyWeek}>
                            Week {entry.weekNumber}, {entry.weekYear}
                          </Text>
                          <Text style={styles.historyDate}>
                            {formatDate(d.start)} – {formatDate(d.end)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyPreview} numberOfLines={2}>
                        {entry.content.substring(0, 80)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  appBarRight: {
    flexDirection: 'row',
    gap: 4,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 40,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  weekNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavBtnDisabled: {
    backgroundColor: 'transparent',
  },
  weekInfo: {
    alignItems: 'center',
    gap: 4,
  },
  weekLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  dateRange: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  filledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: `${colors.success}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rounded.full,
  },
  filledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 250,
    lineHeight: 22,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  saveBtn: {
    backgroundColor: colors.primaryContainer,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  contentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 20,
  },
  contentText: {
    fontSize: 15,
    color: colors.onSurface,
    lineHeight: 22,
  },
  updatedText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.outline,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    marginTop: 8,
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  historySection: {
    marginTop: 32,
    gap: 12,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 14,
    gap: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyWeek: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  historyDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  historyPreview: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
    paddingLeft: 28,
  },
});
