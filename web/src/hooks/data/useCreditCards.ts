/**
 * useCreditCards — query + mutations for credit_cards.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CreditCard } from '../../types'

export const cardKeys = {
  all: (userId: string) => ['credit_cards', userId] as const,
}

export function useCreditCards(userId: string) {
  return useQuery({
    queryKey: cardKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', userId)
        .order('name')
      if (error) throw error
      return (data ?? []) as CreditCard[]
    },
    enabled: !!userId,
  })
}

function useCardMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: cardKeys.all(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<CreditCard>; id?: string }) => {
      const payload: Partial<CreditCard> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('credit_cards')
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
      const { error } = await supabase.from('credit_cards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateCard(userId: string) {
  return useCardMutations(userId).upsert
}
export function useUpdateCard(userId: string) {
  return useCardMutations(userId).upsert
}
export function useDeleteCard(userId: string) {
  return useCardMutations(userId).remove
}
