/**
 * useBankAccounts — query + mutations for bank_accounts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { BankAccount } from '../../types'

export const accountKeys = {
  all: (userId: string) => ['bank_accounts', userId] as const,
}

export function useBankAccounts(userId: string) {
  return useQuery({
    queryKey: accountKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('title')
      if (error) throw error
      return (data ?? []) as BankAccount[]
    },
    enabled: !!userId,
  })
}

function useAccountMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: accountKeys.all(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<BankAccount>; id?: string }) => {
      const payload: Partial<BankAccount> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('bank_accounts')
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
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateAccount(userId: string) {
  return useAccountMutations(userId).upsert
}
export function useUpdateAccount(userId: string) {
  return useAccountMutations(userId).upsert
}
export function useDeleteAccount(userId: string) {
  return useAccountMutations(userId).remove
}

/** Update only the balance of an account. */
export function useUpdateAccountBalance(userId: string) {
  const { upsert } = useAccountMutations(userId)
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      upsert.mutateAsync({ id, row: { amount } }),
  })
}