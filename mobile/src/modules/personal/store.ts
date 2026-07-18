import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersonalGoal {
  id: string;
  name: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface Recipe {
  id: string;
  title: string;
  prepTime: string;
  calories: string;
  ingredients: string[];
  steps: string[];
}

export interface MealPlan {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

interface PersonalState {
  goals: PersonalGoal[];
  notes: Note[];
  recipes: Recipe[];
  meals: MealPlan[];
  toggleGoal: (id: string) => void;
  addGoal: (name: string) => void;
  addNote: (title: string, content: string) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, title: string, content: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => void;
  updateMealSlot: (day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', name: string) => void;
}

export const usePersonalStore = create<PersonalState>()(
  persist(
    (set) => ({
      goals: [
        { id: '1', name: 'Read 24 books this year', completed: false },
        { id: '2', name: 'Complete React Native certification', completed: true },
        { id: '3', name: 'Run 10km under 50 minutes', completed: false },
      ],
      notes: [
        {
          id: '1',
          title: 'Project Roadmap',
          content: 'Meridian app build roadmap. Focus on Core Finance dashboard, then Vehicle garage filling logs, next is Tasks lists, and finally Kite Integration.',
          date: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: '2',
          title: 'Grocery List',
          content: 'Milk, Eggs, Wholewheat Bread, Avocados, Chicken breasts, Peanut butter, Bananas, Spinach.',
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      recipes: [
        {
          id: '1',
          title: 'High Protein Oats Bowl',
          prepTime: '10 mins',
          calories: '450 kcal',
          ingredients: ['Oats (50g)', 'Whey protein (30g)', 'Almond milk (150ml)', 'Chia seeds', 'Berries', 'Banana slice'],
          steps: ['Cook oats in almond milk on medium heat.', 'Stir in whey protein after taking off heat.', 'Top with chia seeds, banana slices, and berries.'],
        },
        {
          id: '2',
          title: 'Avocado Chicken Salad',
          prepTime: '15 mins',
          calories: '520 kcal',
          ingredients: ['Grilled chicken breast (150g)', 'Avocado (1)', 'Spinach (50g)', 'Cherry tomatoes', 'Olive oil', 'Lemon juice'],
          steps: ['Dice grilled chicken and avocado.', 'Toss in a bowl with spinach and sliced tomatoes.', 'Drizzle olive oil and squeeze fresh lemon.'],
        },
      ],
      meals: [
        { day: 'Monday', breakfast: 'Protein Oats', lunch: 'Chicken Salad', dinner: 'Tofu stir-fry', snack: 'Almonds' },
        { day: 'Tuesday', breakfast: 'Scrambled Eggs', lunch: 'Salmon Bowl', dinner: 'Chicken soup', snack: 'Apple + PB' },
        { day: 'Wednesday', breakfast: 'Protein Oats', lunch: 'Chicken Salad', dinner: 'Fish Tacos', snack: 'Yogurt' },
        { day: 'Thursday', breakfast: 'Avocado Toast', lunch: 'Quinoa Veggies', dinner: 'Turkey wrap', snack: 'Whey shake' },
        { day: 'Friday', breakfast: 'Scrambled Eggs', lunch: 'Salmon Bowl', dinner: 'Steak & Salad', snack: 'Berries' },
        { day: 'Saturday', breakfast: 'Pancakes (Oat)', lunch: 'Cheat Meal', dinner: 'Soup', snack: 'Smoothie' },
        { day: 'Sunday', breakfast: 'Fruit bowl', lunch: 'Rice & Chicken', dinner: 'Light salad', snack: 'Mixed nuts' },
      ],
      toggleGoal: (id) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
        }));
      },
      addGoal: (name) => {
        set((state) => ({
          goals: [...state.goals, { id: Math.random().toString(36).substring(2, 9), name, completed: false }],
        }));
      },
      addNote: (title, content) => {
        const newNote: Note = {
          id: Math.random().toString(36).substring(2, 9),
          title,
          content,
          date: new Date().toISOString(),
        };
        set((state) => ({
          notes: [newNote, ...state.notes],
        }));
      },
      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
      },
      updateNote: (id, title, content) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, title, content, date: new Date().toISOString() } : n)),
        }));
      },
      addRecipe: (recipe) => {
        const newRecipe: Recipe = {
          ...recipe,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));
      },
      updateMealSlot: (day, slot, name) => {
        set((state) => ({
          meals: state.meals.map((m) => (m.day === day ? { ...m, [slot]: name } : m)),
        }));
      },
    }),
    {
      name: 'meridian-personal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
