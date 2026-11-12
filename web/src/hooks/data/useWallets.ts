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
  { id: 'hp_pay', name: 'HP Pay' },
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

/** The wallet the fuel log is paid from. */
export const HP_PAY_WALLET_ID = 'hp_pay'

/**
 * Move the HP Pay wallet balance by `deltaPaise` (negative = the wallet was
 * spent). The balance never goes below zero.
 */
export function useAdjustHpPayWallet(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deltaPaise: number) => {
      const { data, error } = await supabase
        .from('wallets')
        .select('amount')
        .eq('id', HP_PAY_WALLET_ID)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return
      const next = Math.max(0, (data.amount ?? 0) + deltaPaise)
      const { error: updErr } = await supabase
        .from('wallets')
        .update({ amount: next })
        .eq('id', HP_PAY_WALLET_ID)
        .eq('user_id', userId)
      if (updErr) throw updErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.all(userId) }),
  })
}
