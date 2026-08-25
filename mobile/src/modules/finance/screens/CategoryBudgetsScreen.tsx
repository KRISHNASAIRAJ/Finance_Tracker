/**
 * CategoryBudgetsScreen — manage monthly spend limits per expense category.
 * Shows spent-vs-limit progress for the current month; supports add/edit/delete.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { EXPENSE_CATEGORIES, getCategoryColor } from '../../../shared/categoryMap';
import CategoryIcon from '../../../shared/CategoryIcon';
import { useAuth } from '../../../services/AuthProvider';

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;

export default function CategoryBudgetsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { transactions, categoryBudgets, setCategoryBudget, deleteCategoryBudget } = useFinanceStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [amountInput, setAmountInput] = useState('');

  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === 'income' || tx.type === 'credit_card_bill') continue;
      if (!tx.date.startsWith(monthKey)) continue;
      map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
    }
    return map;
  }, [transactions, monthKey]);

  const totalLimits = categoryBudgets.reduce((sum, b) => sum + b.amountPaise, 0);

  const openAdd = () => {
    setEditingCategory(null);
    setSelectedCategory(EXPENSE_CATEGORIES[0].name);
    setAmountInput('');
    setModalVisible(true);
  };

  const openEdit = (category: string) => {
    const budget = categoryBudgets.find((b) => b.category === category);
    setEditingCategory(category);
    setSelectedCategory(category);
    setAmountInput(budget ? (budget.amountPaise / 100).toString() : '');
    setModalVisible(true);
  };

  const save = () => {
    const paise = Math.round(parseFloat(amountInput) * 100);
    if (isNaN(paise) || paise <= 0) { alert('Enter a valid monthly limit'); return; }
    setCategoryBudget(selectedCategory, paise, user?.id);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Category Limits</Text>
        <TouchableOpacity style={styles.iconButton} onPress={openAdd}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL MONTHLY LIMITS</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalLimits)}</Text>
          <Text style={styles.summarySub}>
            {categoryBudgets.length} category{categoryBudgets.length === 1 ? '' : 'ies'} tracked
          </Text>
        </View>

        {/* List of budgets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIMITS THIS MONTH</Text>
          <View style={styles.listContainer}>
            {categoryBudgets.length === 0 && (
              <View style={styles.emptyRow}>
                <Ionicons name="options-outline" size={22} color={colors.onSurfaceVariant} />
                <Text style={styles.emptyText}>
                  No limits set. Tap + to add a monthly spend limit for a category.
                </Text>
              </View>
            )}
            {categoryBudgets.map((budget) => {
              const spent = spentByCategory.get(budget.category) ?? 0;
              const pct = budget.amountPaise > 0 ? Math.min(100, (spent / budget.amountPaise) * 100) : 0;
              const over = spent > budget.amountPaise;
              const catColor = getCategoryColor(budget.category, false);

              return (
                <View key={budget.category} style={styles.rowItem}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.iconWrapper, { backgroundColor: `${catColor}15` }]}>
                      <CategoryIcon category={budget.category} size={17} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{budget.category}</Text>
                      <Text style={[styles.itemSubtitle, over && { color: colors.error }]}>
                        {formatCurrency(spent)} / {formatCurrency(budget.amountPaise)} spent
                        {over ? ' · over limit' : ''}
                      </Text>
                      {/* Progress bar */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: over ? colors.error : colors.success,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    <TouchableOpacity style={styles.editButton} onPress={() => openEdit(budget.category)} activeOpacity={0.8}>
                      <Ionicons name="pencil" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteCategoryBudget(budget.category, user?.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Add/Edit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCategory ? `Edit ${editingCategory} limit` : 'Add category limit'}
            </Text>

            <Text style={styles.modalLabel}>CATEGORY</Text>
            <ScrollView style={styles.categoryPicker} horizontal showsHorizontalScrollIndicator={false}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>MONTHLY LIMIT (₹)</Text>
            <TextInput
              style={styles.modalInput}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 6000"
              placeholderTextColor={colors.outline}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={save} activeOpacity={0.8}>
                <Text style={styles.modalSaveText}>{editingCategory ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
  },
  summarySub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  listContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.cardPadding,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  progressTrack: {
    height: 5,
    borderRadius: rounded.full,
    backgroundColor: colors.surface,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: rounded.full,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: `${colors.primary}14`,
    borderRadius: rounded.DEFAULT,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: `${colors.error}14`,
    borderRadius: rounded.DEFAULT,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: rounded.lg,
    borderTopRightRadius: rounded.lg,
    padding: spacing.containerPadding,
    gap: 8,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
    marginTop: 8,
  },
  categoryPicker: {
    flexGrow: 0,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: rounded.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  categoryChipTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: rounded.DEFAULT,
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.primaryContainer,
  },
  modalSaveText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
