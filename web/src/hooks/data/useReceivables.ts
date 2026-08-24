/**
 * useReceivables — lent/borrowed records.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Receivable } from '../../types'

export const recvKeys = {
  all: (userId: string) => ['receivables', userId] as const,
}

export function useReceivables(userId: string) {
  return useQuery({
    queryKey: recvKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as Receivable[]
    },
    enabled: !!userId,
  })
}

function useRecvMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: recvKeys.all(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Receivable>; id?: string }) => {
      const payload: Partial<Receivable> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('receivables')
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
      const { error } = await supabase.from('receivables').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateReceivable(userId: string) {
  return useRecvMutations(userId).upsert
}
export function useUpdateReceivable(userId: string) {
  return useRecvMutations(userId).upsert
}
export function useDeleteReceivable(userId: string) {
  return useRecvMutations(userId).remove
}

/** Mark a lent/borrowed record fully paid (or update partial amount). */
export function useMarkReceivablePaid(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paidAmount, amount }: { id: string; paidAmount: number; amount: number }) => {
      // UPDATE only the changed fields — upsert would violate NOT NULL
      // person_name/amount on the INSERT branch
      const { error } = await supabase
        .from('receivables')
        .update({
          paid_amount: paidAmount,
          status: paidAmount >= amount ? 'paid' : 'partial',
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recvKeys.all(userId) }),
  })
}