/**
 * usePayzapp + expected incomes + user settings + combined misc hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CategoryBudget, ExpectedIncome, PayzappLoad, UserSettings } from '../../types'

// ─── Payzapp loads ───────────────────────────────────────

export const payzappKeys = {
  all: (userId: string) => ['payzapp_loads', userId] as const,
}

export function usePayzappLoads(userId: string) {
  return useQuery({
    queryKey: payzappKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payzapp_loads')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as PayzappLoad[]
    },
    enabled: !!userId,
  })
}

export function useCreatePayzappLoad(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: { amount: number; date: string }) => {
      const { data, error } = await supabase
        .from('payzapp_loads')
        .insert({ ...row, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payzappKeys.all(userId) }),
  })
}

export function useDeletePayzappLoad(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payzapp_loads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payzappKeys.all(userId) }),
  })
}

// ─── Expected incomes ────────────────────────────────────

export const incomeKeys = {
  all: (userId: string) => ['expected_incomes', userId] as const,
}

export function useExpectedIncomes(userId: string) {
  return useQuery({
    queryKey: incomeKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expected_incomes')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ExpectedIncome[]
    },
    enabled: !!userId,
  })
}

export function useUpsertExpectedIncome(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<ExpectedIncome>; id?: string }) => {
      const payload: Partial<ExpectedIncome> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('expected_incomes').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: incomeKeys.all(userId) }),
  })
}

export function useDeleteExpectedIncome(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expected_incomes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: incomeKeys.all(userId) }),
  })
}

// ─── User settings (monthly budget) ──────────────────────

export const settingsKeys = {
  all: (userId: string) => ['user_settings', userId] as const,
}

export function useUserSettings(userId: string) {
  return useQuery({
    queryKey: settingsKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as UserSettings | null
    },
    enabled: !!userId,
  })
}

export function useSetMonthlyBudget(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (monthlyBudget: number) => {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, monthly_budget: monthlyBudget }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all(userId) }),
  })
}

// ─── Category budgets (per-category monthly spend limits) ──

export const categoryBudgetKeys = {
  all: (userId: string) => ['category_budgets', userId] as const,
}

export function useCategoryBudgets(userId: string) {
  return useQuery({
    queryKey: categoryBudgetKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', userId)
        .order('category', { ascending: true })
      if (error) throw error
      return (data ?? []) as CategoryBudget[]
    },
    enabled: !!userId,
  })
}

export function useUpsertCategoryBudget(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ category, amountPaise }: { category: string; amountPaise: number }) => {
      const { error } = await supabase
        .from('category_budgets')
        .upsert({ user_id: userId, category, amount_paise: amountPaise }, { onConflict: 'user_id,category' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryBudgetKeys.all(userId) }),
  })
}

export function useDeleteCategoryBudget(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (category: string) => {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('user_id', userId)
        .eq('category', category)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryBudgetKeys.all(userId) }),
  })
}

// ─── Portfolio action plan ───────────────────────────────

export const planKeys = {
  all: (userId: string) => ['portfolio_action_plans', userId] as const,
}

export function usePortfolioActionPlan(userId: string) {
  return useQuery({
    queryKey: planKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_action_plans')
        .select('content')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data?.content ?? ''
    },
    enabled: !!userId,
  })
}

export function useSavePortfolioActionPlan(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('portfolio_action_plans')
        .upsert({ user_id: userId, content }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.all(userId) }),
  })
}