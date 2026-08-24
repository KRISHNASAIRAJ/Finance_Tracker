/**
 * useInvestments — holdings, investment goals, portfolio snapshots.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Holding, InvestmentGoal, PortfolioSnapshot } from '../../types'

export const investKeys = {
  holdings: (userId: string) => ['holdings', userId] as const,
  goals: (userId: string) => ['investment_goals', userId] as const,
  snapshots: (userId: string) => ['portfolio_snapshots', userId] as const,
}

// ─── Holdings ────────────────────────────────────────────

export function useHoldings(userId: string) {
  return useQuery({
    queryKey: investKeys.holdings(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .order('symbol')
      if (error) throw error
      return (data ?? []) as Holding[]
    },
    enabled: !!userId,
  })
}

function useHoldingMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: investKeys.holdings(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Holding>; id?: string }) => {
      const payload: Partial<Holding> = { ...row, user_id: userId }
      if (id) payload.id = id
      if (payload.quantity !== undefined && payload.current_price != null) {
        payload.current_value = payload.quantity * payload.current_price
      }
      const { data, error } = await supabase
        .from('holdings')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holdings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateHolding(userId: string) {
  return useHoldingMutations(userId).upsert
}
export function useUpdateHolding(userId: string) {
  return useHoldingMutations(userId).upsert
}
export function useDeleteHolding(userId: string) {
  return useHoldingMutations(userId).remove
}

// ─── Investment goals ────────────────────────────────────

export function useInvestmentGoals(userId: string) {
  return useQuery({
    queryKey: investKeys.goals(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_goals')
        .select('*')
        .eq('user_id', userId)
        .order('target_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as InvestmentGoal[]
    },
    enabled: !!userId,
  })
}

function useGoalMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: investKeys.goals(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<InvestmentGoal>; id?: string }) => {
      const payload: Partial<InvestmentGoal> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('investment_goals')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateGoal(userId: string) {
  return useGoalMutations(userId).upsert
}
export function useUpdateGoal(userId: string) {
  return useGoalMutations(userId).upsert
}
export function useDeleteGoal(userId: string) {
  return useGoalMutations(userId).remove
}

// ─── Portfolio snapshots ─────────────────────────────────

export function usePortfolioSnapshots(userId: string) {
  return useQuery({
    queryKey: investKeys.snapshots(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as PortfolioSnapshot[]
    },
    enabled: !!userId,
  })
}

export function useDeleteSnapshot(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('portfolio_snapshots')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: investKeys.snapshots(userId) }),
  })
}

/** Trigger the refresh-portfolio-prices edge function. */
export function useRefreshPrices() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('refresh-portfolio-prices', {
        body: {},
      })
      if (error) throw error
      return data
    },
  })
}