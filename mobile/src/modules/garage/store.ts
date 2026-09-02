/**
 * Garage module Zustand store — fuel fills, maintenance logs, and vehicle records
 * with persisted state and cross-module transaction linking.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFinanceStore } from '../finance/store';

export interface FuelFill {
  id: string;
  vehicle: string;
  date: string;
  amount: number; // paise
  liters: number;
  pricePerLiter: number; // paise
  odometer: number;
  station?: string;
  note?: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle: string;
  date: string;
  amount: number; // paise
  serviceType: string;
  odometer?: number; // km at service time
  notes?: string;
}

export interface VehicleRecord {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

interface GarageState {
  vehicles: string[];
  fills: FuelFill[];
  maintenance: MaintenanceLog[];
  addVehicle: (name: string, userId?: string) => void;
  editVehicle: (oldName: string, newName: string, userId?: string) => void;
  deleteVehicle: (name: string, userId?: string) => void;
  addFuelFill: (fill: Omit<FuelFill, 'id' | 'date'> & { date?: string }, userId?: string) => string;
  editFuelFill: (id: string, updated: Partial<FuelFill>, userId?: string) => void;
  deleteFuelFill: (id: string, userId?: string) => void;
  addMaintenanceLog: (log: Omit<MaintenanceLog, 'id' | 'date'> & { date?: string }, userId?: string) => string;
  editMaintenanceLog: (id: string, updated: Partial<MaintenanceLog>, userId?: string) => void;
  deleteMaintenanceLog: (id: string, userId?: string) => void;
  seedMaintenanceLogs: (vehicle: string, logs: Array<Omit<MaintenanceLog, 'id'>>) => void;
  getVehicleFills: (vehicle: string) => FuelFill[];
  getVehicleSpendTotal: (vehicle: string) => number;
}

const rupeeToPaise = (val: number) => Math.round(val * 100);

function queueGarageSync(entity: string, operation: string, payload: Record<string, unknown>) {
  try {
    const { enqueue, processSyncQueue } = require('../../services/syncQueue');
    const action = operation === 'delete' ? 'delete' as const : 'create' as const;
    enqueue(entity, action, payload).finally(() => {
      processSyncQueue().catch((e: Error) => console.warn('[GarageStore] flush failed:', e));
    }).catch((e: Error) => console.warn('[GarageStore] enqueue failed:', e));
  } catch (e) { console.warn('[GarageStore] queueGarageSync failed:', e); }
}

function addFuelTransaction(userId: string | undefined, fill: FuelFill) {
  if (!userId) return;
  useFinanceStore.getState().addTransaction(
    {
      type: 'fuel_purchase',
      amount: fill.amount,
      currency: 'INR',
      category: 'Fuel',
      notes: `${Number(fill.liters).toFixed(2)}L Fuel`,
      source: 'manual',
      date: fill.date,
    },
    userId
  );
}

export const useGarageStore = create<GarageState>()(
  persist(
    (set, get) => ({
      vehicles: [],
      fills: [],
      maintenance: [],
      addVehicle: (name, userId) => {
        set((state) => ({
          vehicles: [...state.vehicles, name],
        }));
        queueGarageSync('vehicles', 'upsert', { name, user_id: userId || null });
      },
      editVehicle: (oldName, newName, userId) => {
        set((state) => ({
          vehicles: state.vehicles.map((v) => (v === oldName ? newName : v)),
          fills: state.fills.map((f) => (f.vehicle === oldName ? { ...f, vehicle: newName } : f)),
          maintenance: state.maintenance.map((m) => (m.vehicle === oldName ? { ...m, vehicle: newName } : m)),
        }));
        queueGarageSync('vehicles', 'upsert', { name: newName, user_id: userId || null });
      },
      deleteVehicle: (name, userId) => {
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v !== name),
          fills: state.fills.filter((f) => f.vehicle !== name),
          maintenance: state.maintenance.filter((m) => m.vehicle !== name),
        }));
        queueGarageSync('vehicles', 'delete', { name, user_id: userId || null });
      },
      addFuelFill: (fill, userId) => {
        const newFill: FuelFill = {
          ...fill,
          id: Math.random().toString(36).substring(2, 9),
          date: fill.date || new Date().toISOString(),
        };
        set((state) => ({
          fills: [newFill, ...state.fills],
        }));
        addFuelTransaction(userId, newFill);
        queueGarageSync('fuel_fills', 'upsert', {
          id: newFill.id,
          user_id: userId || null,
          vehicle: newFill.vehicle,
          date: newFill.date,
          amount: newFill.amount,
          liters: newFill.liters,
          price_per_liter: newFill.pricePerLiter,
          odometer: newFill.odometer,
          station: newFill.station ?? null,
          note: newFill.note ?? null,
        });
        return newFill.id;
      },
      editFuelFill: (id, updated, userId) => {
        set((state) => ({
          fills: state.fills.map((f) => (f.id === id ? { ...f, ...updated } : f)),
        }));
        const fill = get().fills.find((f) => f.id === id);
        if (fill) {
          queueGarageSync('fuel_fills', 'upsert', {
            id: fill.id,
            user_id: userId || null,
            vehicle: fill.vehicle,
            date: fill.date,
            amount: fill.amount,
            liters: fill.liters,
            price_per_liter: fill.pricePerLiter,
            odometer: fill.odometer,
            station: fill.station ?? null,
            note: fill.note ?? null,
          });
        }
      },
      deleteFuelFill: (id, userId) => {
        set((state) => ({
          fills: state.fills.filter((f) => f.id !== id),
        }));
        queueGarageSync('fuel_fills', 'delete', { id, user_id: userId || null });
        const { supabase } = require('../../services/supabaseClient');
        supabase.from('fuel_fills').delete().eq('id', id).then(({ error }: any) => {
          if (error) console.warn('[GarageStore] delete fill from Supabase failed:', error.message);
        });
      },
      addMaintenanceLog: (log, userId) => {
        const newLog: MaintenanceLog = {
          ...log,
          id: Math.random().toString(36).substring(2, 9),
          date: log.date || new Date().toISOString(),
        };
        set((state) => ({
          maintenance: [newLog, ...state.maintenance],
        }));
        queueGarageSync('maintenance_logs', 'upsert', {
          id: newLog.id,
          user_id: userId || null,
          vehicle: newLog.vehicle,
          date: newLog.date,
          amount: newLog.amount,
          service_type: newLog.serviceType,
          odometer: newLog.odometer ?? null,
          notes: newLog.notes ?? null,
        });
        return newLog.id;
      },
      editMaintenanceLog: (id, updated, userId) => {
        set((state) => ({
          maintenance: state.maintenance.map((m) => (m.id === id ? { ...m, ...updated } : m)),
        }));
        const log = get().maintenance.find((m) => m.id === id);
        if (log) {
          queueGarageSync('maintenance_logs', 'upsert', {
            id: log.id,
            user_id: userId || null,
            vehicle: log.vehicle,
            date: log.date,
            amount: log.amount,
            service_type: log.serviceType,
            odometer: log.odometer ?? null,
            notes: log.notes ?? null,
          });
        }
      },
      deleteMaintenanceLog: (id, userId) => {
        set((state) => ({
          maintenance: state.maintenance.filter((m) => m.id !== id),
        }));
        queueGarageSync('maintenance_logs', 'delete', { id, user_id: userId || null });
      },
      seedMaintenanceLogs: (vehicle, logs) => {
        const seeded: MaintenanceLog[] = logs.map((log) => ({
          ...log,
          vehicle,
          id: `seed-${Math.random().toString(36).substring(2, 9)}`,
        }));
        set((state) => ({
          maintenance: [...seeded, ...state.maintenance],
        }));
      },
      getVehicleFills: (vehicle) => {
        return get().fills.filter((f) => f.vehicle === vehicle);
      },
      getVehicleSpendTotal: (vehicle) => {
        const vehicleFills = get().fills.filter((f) => f.vehicle === vehicle);
        const vehicleMaint = get().maintenance.filter((m) => m.vehicle === vehicle);
        const fuelTotal = vehicleFills.reduce((sum, f) => sum + f.amount, 0);
        const maintTotal = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);
        return fuelTotal + maintTotal;
      },
    }),
    {
      name: 'meridian-garage-storage-v8',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (state) => state as GarageState,
    }
  )
);

const SEED_FLAG_KEY = 'meridian-garage-seeded-v1';

/**
 * One-time seed of the user's real historical services so km-based
 * service reminders have a baseline. Local-only (no cloud sync), guarded
 * by an AsyncStorage flag so it never runs twice.
 */
export async function seedGarageData(): Promise<void> {
  try {
    const flag = await AsyncStorage.getItem(SEED_FLAG_KEY);
    if (flag === 'done') return;
    const { vehicles, maintenance } = useGarageStore.getState();
    if (vehicles.length === 0 || maintenance.length > 0) return;

    const vehicle = vehicles[0];
    const seeds: Array<Omit<MaintenanceLog, 'id'>> = [
      { vehicle, serviceType: 'General Service', amount: 72700, odometer: 651, date: '2026-06-06T12:00:00+05:30', notes: '1st service' },
      { vehicle, serviceType: 'General Service', amount: 88700, odometer: 1605, date: '2026-07-03T12:00:00+05:30', notes: '2nd service' },
      { vehicle, serviceType: 'General Service', amount: 88700, odometer: 2620, date: '2026-08-07T12:00:00+05:30', notes: '3rd service' },
    ];
    useGarageStore.getState().seedMaintenanceLogs(vehicle, seeds);
    await AsyncStorage.setItem(SEED_FLAG_KEY, 'done');
    console.log('[GarageStore] Seeded historical service logs:', seeds.length);
  } catch (e) {
    console.warn('[GarageStore] seedGarageData failed:', e);
  }
}
