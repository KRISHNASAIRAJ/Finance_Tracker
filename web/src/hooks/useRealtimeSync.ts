/**
 * useRealtimeSync — subscribes to Postgres changes for the signed-in user's
 * tables and invalidates the matching TanStack Query caches so the web app
 * reflects mobile-app changes immediately (and vice-versa).
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Every table queried by the web app, mapped to its query key prefix. */
const REALTIME_TABLES = [
  'transactions',
  'credit_cards',
  'bank_accounts',
  'receivables',
  'fixed_expenses',
  'payzapp_loads',
  'expected_incomes',
  'user_settings',
  'portfolio_action_plans',
  'vehicles',
  'fuel_fills',
  'maintenance_logs',
  'tasks',
  'holdings',
  'investment_goals',
  'portfolio_snapshots',
  'goals',
  'notes',
  'recipes',
  'diet_plans',
  'meal_logs',
  'weight_logs',
  'career_events',
  'weekly_diary',
] as const

export function useRealtimeSync(userId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const channels = REALTIME_TABLES.map((table) =>
      supabase
        .channel(`rt-${table}-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: [table, userId] })
          }
        )
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [userId, qc])
}
