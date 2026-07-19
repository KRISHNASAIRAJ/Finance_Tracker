import React, { useState } from 'react';
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
import { usePersonalStore, Recipe } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { queueRecipeSync } from '../hooks/usePersonalSync';

export default function RecipesLibraryScreen() {
  const navigation = useNavigation();
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = usePersonalStore();
  const { user } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [calories, setCalories] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');

  const resetForm = () => {
    setEditingRecipe(null);
    setTitle('');
    setPrepTime('');
    setCalories('');
    setIngredientsText('');
    setStepsText('');
  };

  const openEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setTitle(recipe.title);
    setPrepTime(recipe.prepTime);
    setCalories(recipe.calories);
    setIngredientsText(recipe.ingredients.join('\n'));
    setStepsText(recipe.steps.join('\n'));
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a recipe title');
      return;
    }
    const ingredients = ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean);

    if (editingRecipe) {
      updateRecipe(editingRecipe.id, {
        title: title.trim(),
        prepTime: prepTime.trim() || '—',
        calories: calories.trim() || '—',
        ingredients,
        steps,
      });
      if (user) queueRecipeSync(user.id, 'update', { id: editingRecipe.id, title: title.trim(), prepTime, calories, ingredients, steps });
    } else {
      const id = addRecipe({
        title: title.trim(),
        prepTime: prepTime.trim() || '—',
        calories: calories.trim() || '—',
        ingredients,
        steps,
      });
      if (user) queueRecipeSync(user.id, 'create', { id, title: title.trim(), prepTime, calories, ingredients, steps });
    }
    resetForm();
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Recipes Library</Text>
        <TouchableOpacity style={styles.fabSmall} onPress={() => { resetForm(); setModalVisible(true); }}>
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {recipes.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No recipes yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first recipe</Text>
          </View>
        )}
        {recipes.map((recipe) => (
          <View key={recipe.id} style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <View style={styles.recipeActions}>
                <TouchableOpacity onPress={() => openEdit(recipe)} style={{ padding: 4 }}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { deleteRecipe(recipe.id); if (user) queueRecipeSync(user.id, 'delete', { id: recipe.id }); }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Metas */}
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Ionicons name="time-outline" size={12} color={colors.primary} />
                <Text style={styles.metaText}>{recipe.prepTime}</Text>
              </View>
              <View style={[styles.metaBadge, { backgroundColor: `${colors.success}10` }]}>
                <Ionicons name="flame-outline" size={12} color={colors.success} />
                <Text style={[styles.metaText, { color: colors.success }]}>{recipe.calories}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Ingredients */}
            <Text style={styles.sectionLabel}>INGREDIENTS</Text>
            <View style={styles.bulletList}>
              {recipe.ingredients.map((ing, i) => (
                <Text key={i} style={styles.bulletItem}>
                  • {ing}
                </Text>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Steps */}
            <Text style={styles.sectionLabel}>PREPARATION STEPS</Text>
            <View style={styles.stepList}>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Recipe Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TITLE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. High Protein Oats"
                placeholderTextColor={colors.outline}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>PREP TIME</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 10 mins"
                  placeholderTextColor={colors.outline}
                  value={prepTime}
                  onChangeText={setPrepTime}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>CALORIES</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 450 kcal"
                  placeholderTextColor={colors.outline}
                  value={calories}
                  onChangeText={setCalories}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>INGREDIENTS (one per line)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Oats (50g)&#10;Whey protein (30g)&#10;Almond milk (150ml)"
                placeholderTextColor={colors.outline}
                value={ingredientsText}
                onChangeText={setIngredientsText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>STEPS (one per line)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Cook oats in almond milk.&#10;Stir in whey protein.&#10;Top with berries."
                placeholderTextColor={colors.outline}
                value={stepsText}
                onChangeText={setStepsText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { resetForm(); setModalVisible(false); }}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSave}>
                <Text style={styles.modalBtnTextSave}>Save Recipe</Text>
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  fabSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.outline,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 20,
    paddingBottom: 40,
  },
  recipeCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 12,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
  },
  recipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}10`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    fontSize: 13,
    color: colors.onSurface,
  },
  stepList: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: `${colors.primary}15`,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnSave: {
    backgroundColor: colors.primaryContainer,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  modalBtnTextSave: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});
