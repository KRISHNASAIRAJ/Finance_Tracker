/**
 * useRealtimeSync — subscribes to Postgres changes for the signed-in user's
 * tables and invalidates the matching TanStack Query caches so the web app
 * reflects mobile-app changes immediately (and vice-versa).
 *
 * Uses ONE channel with no table filter (RLS-scoped) instead of 24 per-table
 * channels — more reliable on the free tier and picks up any new table
 * automatically. Invalidations are debounced so a local mutation's `onSuccess`,
 * its realtime echo, and StrictMode's double-subscribe collapse into a single
 * refetch instead of a storm.
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 250

export function useRealtimeSync(userId: string) {
  const qc = useQueryClient()
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) return

    const schedule = (keys?: readonly (readonly unknown[])[]) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        if (keys?.length) {
          for (const key of keys) qc.invalidateQueries({ queryKey: key as unknown[] })
        } else {
          qc.invalidateQueries()
        }
      }, DEBOUNCE_MS)
    }

    // Scope the topic to the user so a re-auth or StrictMode remount can never
    // leave two live channels sharing one name and delivering duplicate events.
    const channel = supabase
      .channel(`rt-meridian-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table
          if (!table) return
          // Invalidate by table + user prefix — TanStack partial-matches.
          schedule([[table, userId]])
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // One refresh on connect covers anything missed while offline.
          schedule()
        }
      })

    // Safety net: periodic refetch so a long-open tab never goes stale.
    const interval = window.setInterval(() => schedule(), 60_000)

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [userId, qc])
}
