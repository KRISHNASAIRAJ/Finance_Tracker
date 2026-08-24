/**
 * useRealtimeSync — subscribes to Postgres changes for the signed-in user's
 * tables and invalidates the matching TanStack Query caches so the web app
 * reflects mobile-app changes immediately (and vice-versa).
 *
 * Uses ONE channel with no table filter (RLS-scoped) instead of 24 per-table
 * channels — more reliable on the free tier and picks up any new table
 * automatically.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRealtimeSync(userId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('rt-meridian-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table
          if (!table) return
          // Invalidate by table + user prefix — TanStack partial-matches
          qc.invalidateQueries({ queryKey: [table, userId] })
          // Also invalidate combined/dashboard queries that aggregate many tables
          qc.invalidateQueries({ queryKey: ['user_settings', userId] })
          qc.invalidateQueries({ queryKey: ['portfolio_action_plans', userId] })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Fresh data on connect — covers anything missed while offline
          qc.invalidateQueries()
        }
      })

    // Safety net: periodic refetch so long-open tabs never go stale
    const interval = window.setInterval(() => {
      qc.invalidateQueries()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [userId, qc])
}
