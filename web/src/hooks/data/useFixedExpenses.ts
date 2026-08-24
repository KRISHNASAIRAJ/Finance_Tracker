/**
 * useFixedExpenses — fixed/recurring expenses (bills, subscriptions).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { FixedExpense } from '../../types'

export const fixedKeys = {
  all: (userId: string) => ['fixed_expenses', userId] as const,
}

export function useFixedExpenses(userId: string) {
  return useQuery({
    queryKey: fixedKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('user_id', userId)
        .order('name')
      if (error) throw error
      return (data ?? []) as FixedExpense[]
    },
    enabled: !!userId,
  })
}

function useFixedMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: fixedKeys.all(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<FixedExpense>; id?: string }) => {
      const payload: Partial<FixedExpense> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('fixed_expenses')
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
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateFixedExpense(userId: string) {
  return useFixedMutations(userId).upsert
}
export function useUpdateFixedExpense(userId: string) {
  return useFixedMutations(userId).upsert
}
export function useDeleteFixedExpense(userId: string) {
  return useFixedMutations(userId).remove
}
