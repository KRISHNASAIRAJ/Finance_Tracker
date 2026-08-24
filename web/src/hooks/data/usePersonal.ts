/**
 * usePersonal — notes, goals 2026, recipes, diet plans, meal/weight/career/diary.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CareerEvent, DiaryEntry, Goal2026, MealLogEntry, Note, Recipe, WeightEntry } from '../../types'

// ─── Goals 2026 ──────────────────────────────────────────

export const goalKeys = {
  all: (userId: string) => ['goals', userId] as const,
}

export function useGoals2026(userId: string) {
  return useQuery({
    queryKey: goalKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Goal2026[]
    },
    enabled: !!userId,
  })
}

export function useUpsertGoal2026(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Goal2026>; id?: string }) => {
      const payload: Partial<Goal2026> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('goals').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all(userId) }),
  })
}

export function useDeleteGoal2026(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all(userId) }),
  })
}

// ─── Notes ───────────────────────────────────────────────

export const noteKeys = {
  all: (userId: string) => ['notes', userId] as const,
}

export function useNotes(userId: string) {
  return useQuery({
    queryKey: noteKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Note[]
    },
    enabled: !!userId,
  })
}

export function useUpsertNote(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Note>; id?: string }) => {
      const payload: Partial<Note> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all(userId) }),
  })
}

export function useDeleteNote(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all(userId) }),
  })
}

// ─── Recipes ─────────────────────────────────────────────

export const recipeKeys = {
  all: (userId: string) => ['recipes', userId] as const,
}

export function useRecipes(userId: string) {
  return useQuery({
    queryKey: recipeKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('title')
      if (error) throw error
      return (data ?? []) as Recipe[]
    },
    enabled: !!userId,
  })
}

export function useUpsertRecipe(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Recipe>; id?: string }) => {
      const payload: Partial<Recipe> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('recipes').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all(userId) }),
  })
}

export function useDeleteRecipe(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all(userId) }),
  })
}

// ─── Diet plans ──────────────────────────────────────────

export const dietKeys = {
  all: (userId: string) => ['diet_plans', userId] as const,
}

export function useDietPlans(userId: string) {
  return useQuery({
    queryKey: dietKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('user_id', userId)
        .order('day')
      if (error) throw error
      return (data ?? []) as Array<{ id: string; day: string; meal_type: string; meal_name: string }>
    },
    enabled: !!userId,
  })
}

export function useUpdateDietPlan(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      day,
      mealType,
      mealName,
    }: {
      day: string
      mealType: string
      mealName: string
    }) => {
      // delete existing entry for this day+slot, then insert new one
      await supabase.from('diet_plans').delete().eq('user_id', userId).eq('day', day).eq('meal_type', mealType)
      const { error } = await supabase.from('diet_plans').insert({
        user_id: userId,
        day,
        meal_type: mealType,
        meal_name: mealName,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dietKeys.all(userId) }),
  })
}

// ─── Meal logs ───────────────────────────────────────────

export const mealLogKeys = {
  all: (userId: string) => ['meal_logs', userId] as const,
}

export function useMealLogs(userId: string) {
  return useQuery({
    queryKey: mealLogKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as MealLogEntry[]
    },
    enabled: !!userId,
  })
}

export function useUpsertMealLog(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<MealLogEntry>; id?: string }) => {
      const payload: Partial<MealLogEntry> = { ...row, user_id: userId }
      if (id) payload.id = id
      if (payload.items) payload.items = JSON.stringify(payload.items) as unknown as MealLogEntry['items']
      const { error } = await supabase.from('meal_logs').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mealLogKeys.all(userId) }),
  })
}

export function useDeleteMealLog(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mealLogKeys.all(userId) }),
  })
}

// ─── Weight logs ─────────────────────────────────────────

export const weightKeys = {
  all: (userId: string) => ['weight_logs', userId] as const,
}

export function useWeightLogs(userId: string) {
  return useQuery({
    queryKey: weightKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as WeightEntry[]
    },
    enabled: !!userId,
  })
}

export function useUpsertWeight(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<WeightEntry>; id?: string }) => {
      const payload: Partial<WeightEntry> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('weight_logs').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: weightKeys.all(userId) }),
  })
}

export function useDeleteWeight(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weight_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: weightKeys.all(userId) }),
  })
}

// ─── Career events ───────────────────────────────────────

export const careerKeys = {
  all: (userId: string) => ['career_events', userId] as const,
}

export function useCareerEvents(userId: string) {
  return useQuery({
    queryKey: careerKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_events')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as CareerEvent[]
    },
    enabled: !!userId,
  })
}

export function useUpsertCareerEvent(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<CareerEvent>; id?: string }) => {
      const payload: Partial<CareerEvent> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('career_events').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: careerKeys.all(userId) }),
  })
}

export function useDeleteCareerEvent(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('career_events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: careerKeys.all(userId) }),
  })
}

// ─── Weekly diary ────────────────────────────────────────

export const diaryKeys = {
  all: (userId: string) => ['weekly_diary', userId] as const,
}

export function useDiaryEntries(userId: string) {
  return useQuery({
    queryKey: diaryKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_diary')
        .select('*')
        .eq('user_id', userId)
        .order('week_year', { ascending: false })
        .order('week_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as DiaryEntry[]
    },
    enabled: !!userId,
  })
}

export function useUpsertDiaryEntry(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<DiaryEntry>; id?: string }) => {
      const payload: Partial<DiaryEntry> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase
        .from('weekly_diary')
        .upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: diaryKeys.all(userId) }),
  })
}

export function useDeleteDiaryEntry(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_diary').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: diaryKeys.all(userId) }),
  })
}