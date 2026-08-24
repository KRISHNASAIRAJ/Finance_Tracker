/**
 * useGarage — vehicles, fuel fills, maintenance logs.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { FuelFill, MaintenanceLog, Vehicle } from '../../types'

export const garageKeys = {
  vehicles: (userId: string) => ['vehicles', userId] as const,
  fills: (userId: string) => ['fuel_fills', userId] as const,
  maintenance: (userId: string) => ['maintenance_logs', userId] as const,
}

// ─── Vehicles ────────────────────────────────────────────

export function useVehicles(userId: string) {
  return useQuery({
    queryKey: garageKeys.vehicles(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('name')
      if (error) throw error
      return (data ?? []) as Vehicle[]
    },
    enabled: !!userId,
  })
}

export function useUpsertVehicle(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Vehicle>; id?: string }) => {
      const payload: Partial<Vehicle> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('vehicles').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.vehicles(userId) }),
  })
}

export function useDeleteVehicle(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.vehicles(userId) }),
  })
}

// ─── Fuel fills ──────────────────────────────────────────

export function useFuelFills(userId: string) {
  return useQuery({
    queryKey: garageKeys.fills(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_fills')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as FuelFill[]
    },
    enabled: !!userId,
  })
}

export function useUpsertFuelFill(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<FuelFill>; id?: string }) => {
      const payload: Partial<FuelFill> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('fuel_fills').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.fills(userId) }),
  })
}

export function useDeleteFuelFill(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fuel_fills').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.fills(userId) }),
  })
}

// ─── Maintenance logs ────────────────────────────────────

export function useMaintenanceLogs(userId: string) {
  return useQuery({
    queryKey: garageKeys.maintenance(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as MaintenanceLog[]
    },
    enabled: !!userId,
  })
}

export function useUpsertMaintenance(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, id }: { row: Partial<MaintenanceLog>; id?: string }) => {
      const payload: Partial<MaintenanceLog> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { error } = await supabase.from('maintenance_logs').upsert(payload, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.maintenance(userId) }),
  })
}

export function useDeleteMaintenance(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: garageKeys.maintenance(userId) }),
  })
}