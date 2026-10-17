/**
 * useOffers — discount offers / coupons with coupon codes, minimum spend
 * and expiry tracking (reminders fire on mobile 3 & 2 days before expiry).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Offer } from '../../types'

export const offerKeys = {
  all: (userId: string) => ['offers', userId] as const,
}

export function useOffers(userId: string) {
  return useQuery({
    queryKey: offerKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', userId)
        .order('expires_on', { ascending: true })
      if (error) throw error
      return (data ?? []) as Offer[]
    },
    enabled: !!userId,
  })
}

export function useUpsertOffer(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Offer>; id?: string }) => {
      const payload: Partial<Offer> = { ...row, user_id: userId }
      const rowId = id ?? row.id ?? crypto.randomUUID()
      payload.id = rowId
      const { error } = await supabase.from('offers').upsert(payload, { onConflict: 'id' })
      if (error) throw error
      return rowId
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: offerKeys.all(userId) }),
  })
}

export function useDeleteOffer(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('offers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: offerKeys.all(userId) }),
  })
}
