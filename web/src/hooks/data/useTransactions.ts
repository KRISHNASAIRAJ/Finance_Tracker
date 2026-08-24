/**
 * useTransactions — query + mutations for the transactions table.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Transaction } from '../../types'

export const txnKeys = {
  all: ['transactions'] as const,
  list: (userId: string, filters?: unknown) => ['transactions', userId, filters] as const,
}

export function useTransactions(userId: string) {
  return useQuery({
    queryKey: txnKeys.list(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: !!userId,
  })
}

interface UpsertInput {
  row: Partial<Transaction>
  id?: string
}

function useTxnMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: txnKeys.list(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: UpsertInput) => {
      const payload: Partial<Transaction> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('transactions')
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
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateTransaction(userId: string) {
  return useTxnMutations(userId).upsert
}

export function useUpdateTransaction(userId: string) {
  return useTxnMutations(userId).upsert
}

export function useDeleteTransaction(userId: string) {
  return useTxnMutations(userId).remove
}

/** Mark credit card bill paid — updates card + writes a bill payment txn. */
export function usePayCardBill(userId: string) {
  const qc = useQueryClient()
  const { upsert } = useTxnMutations(userId)

  return useMutation({
    mutationFn: async ({
      cardId,
      cardName,
      billAmount,
      paidAmount,
    }: {
      cardId: string
      cardName: string
      billAmount: number
      paidAmount: number
    }) => {
      // Update card
      const { error: cardErr } = await supabase
        .from('credit_cards')
        .update({ paid_amount: paidAmount, current_outstanding: Math.max(0, billAmount - paidAmount) })
        .eq('id', cardId)
      if (cardErr) throw cardErr

      // Record the payment as a transaction
      await upsert.mutateAsync({
        row: {
          type: 'credit_card_bill',
          amount: paidAmount,
          currency: 'INR',
          date: new Date().toISOString(),
          category: 'Bills & Recharge',
          notes: `Credit card bill payment — ${cardName}`,
          source: 'manual',
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit_cards', userId] })
    },
  })
}