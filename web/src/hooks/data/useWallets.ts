/**
 * useWallets — query + mutations for wallets (app wallet balances).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Wallet } from '../../types'

export const walletKeys = {
  all: (userId: string) => ['wallets', userId] as const,
}

/** Wallet providers the app offers out of the box. */
export const WALLET_PROVIDERS = [
  { id: 'amazon_pay', name: 'Amazon Pay' },
  { id: 'phonepe', name: 'PhonePe' },
  { id: 'zepto', name: 'Zepto' },
  { id: 'blinkit', name: 'Blinkit' },
  { id: 'bigbasket', name: 'BigBasket' },
]

/** Providers that left the catalog — their rows are hidden and pruned. */
export const RETIRED_WALLET_IDS = ['paypal', 'airtel']

export function useWallets(userId: string) {
  return useQuery({
    queryKey: walletKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId)
      if (error) throw error
      return (data ?? []) as Wallet[]
    },
    enabled: !!userId,
  })
}

export function useUpsertWallet(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, amount }: { id: string; name: string; amount: number }) => {
      const { data, error } = await supabase
        .from('wallets')
        .upsert({ id, user_id: userId, name, amount }, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data as Wallet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.all(userId) }),
  })
}

export function useDeleteWallet(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wallets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.all(userId) }),
  })
}
