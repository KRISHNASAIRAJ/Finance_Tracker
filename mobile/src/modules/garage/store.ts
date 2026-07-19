import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  addFuelFill: (fill: Omit<FuelFill, 'id' | 'date'>, userId?: string) => string;
  editFuelFill: (id: string, updated: Partial<FuelFill>, userId?: string) => void;
  deleteFuelFill: (id: string, userId?: string) => void;
  addMaintenanceLog: (log: Omit<MaintenanceLog, 'id' | 'date'>, userId?: string) => string;
  editMaintenanceLog: (id: string, updated: Partial<MaintenanceLog>, userId?: string) => void;
  deleteMaintenanceLog: (id: string, userId?: string) => void;
  getVehicleFills: (vehicle: string) => FuelFill[];
  getVehicleSpendTotal: (vehicle: string) => number;
}

const rupeeToPaise = (val: number) => Math.round(val * 100);

function queueGarageSync(entity: string, operation: string, payload: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    const action = operation === 'delete' ? 'delete' as const : 'create' as const;
    enqueue(entity, action, payload);
  } catch { }
}

function addFuelTransaction(
  userId: string | undefined,
  fill: FuelFill,
  addTx: (tx: { type: string; amount: number; currency: string; category: string; notes: string; source: string }, uid?: string) => string
) {
  if (!userId) return;
  const txId = addTx(
    {
      type: 'fuel_purchase',
      amount: fill.amount,
      currency: 'INR',
      category: 'Fuel',
      notes: `${fill.liters}L in ${fill.vehicle} @ ${fill.station || 'Unknown'}`,
      source: 'manual',
    },
    userId
  );
  // Don't try to set linked_vehicle_id on the transaction from here
  // The transaction store manages its own IDs
}

export const useGarageStore = create<GarageState>()(
  persist(
    (set, get) => ({
      vehicles: ['Jupiter 125'],
      fills: [
        {
          id: 'fill-16',
          vehicle: 'Jupiter 125',
          date: new Date(1783881000000).toISOString(),
          amount: rupeeToPaise(3.08 * 115.62),
          liters: 3.08,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 1905,
          station: 'HPCL KONDAPUR',
          note: '',
        },
        {
          id: 'fill-14',
          vehicle: 'Jupiter 125',
          date: new Date(1783276200000).toISOString(),
          amount: rupeeToPaise(2.949 * 115.62),
          liters: 2.949,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 1750,
          station: 'HPCL KONDAPUR',
          note: '',
        },
        {
          id: 'fill-13',
          vehicle: 'Jupiter 125',
          date: new Date(1783017000000).toISOString(),
          amount: rupeeToPaise(1.94 * 115.62),
          liters: 1.94,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 1605,
          station: 'HPCL KONDAPUR',
          note: '',
        },
        {
          id: 'fill-12',
          vehicle: 'Jupiter 125',
          date: new Date(1782844200000).toISOString(),
          amount: rupeeToPaise(3.01 * 115.62),
          liters: 3.01,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 1509,
          station: 'HPCL KONDAPUR',
          note: '',
        },
        {
          id: 'fill-11',
          vehicle: 'Jupiter 125',
          date: new Date(1782066600000).toISOString(),
          amount: rupeeToPaise(3.35 * 116.0),
          liters: 3.35,
          pricePerLiter: rupeeToPaise(116.0),
          odometer: 1339,
          station: 'HPCL MOINABAD',
          note: '',
        },
        {
          id: 'fill-10',
          vehicle: 'Jupiter 125',
          date: new Date(1781375400000).toISOString(),
          amount: rupeeToPaise(3.35 * 115.62),
          liters: 3.35,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 1165,
          station: 'HPCL KONDAPUR',
          note: 'Good mileage',
        },
        {
          id: 'fill-9',
          vehicle: 'Jupiter 125',
          date: new Date(1781202600000).toISOString(),
          amount: rupeeToPaise(2.22 * 116.0),
          liters: 2.22,
          pricePerLiter: rupeeToPaise(116.0),
          odometer: 1001,
          station: 'HPCL MOINABAD',
          note: '',
        },
        {
          id: 'fill-8',
          vehicle: 'Jupiter 125',
          date: new Date(1781029800000).toISOString(),
          amount: rupeeToPaise(2.38 * 115.62),
          liters: 2.38,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 889,
          station: 'HPCL Kondapur',
          note: 'Very less mileage due to traffic',
        },
        {
          id: 'fill-6',
          vehicle: 'Jupiter 125',
          date: new Date(1780684200000).toISOString(),
          amount: rupeeToPaise(3.66 * 115.62),
          liters: 3.66,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 775,
          station: 'HPCL Kondapur',
          note: '',
        },
        {
          id: 'fill-5',
          vehicle: 'Jupiter 125',
          date: new Date(1780425000000).toISOString(),
          amount: rupeeToPaise(3.32 * 115.62),
          liters: 3.32,
          pricePerLiter: rupeeToPaise(115.62),
          odometer: 586,
          station: 'HPCL Kondapur',
          note: 'Avg 56km/l',
        },
        {
          id: 'fill-4',
          vehicle: 'Jupiter 125',
          date: new Date(1780165800000).toISOString(),
          amount: rupeeToPaise(4.08 * 117.57),
          liters: 4.08,
          pricePerLiter: rupeeToPaise(117.57),
          odometer: 418,
          station: 'BPCL HAFEEZPET',
          note: '',
        },
        {
          id: 'fill-3',
          vehicle: 'Jupiter 125',
          date: new Date(1779647400000).toISOString(),
          amount: rupeeToPaise(2.81 * 117.57),
          liters: 2.81,
          pricePerLiter: rupeeToPaise(117.57),
          odometer: 260,
          station: 'BPCL Hafeezpet',
          note: '',
        },
      ],
      maintenance: [],
      addVehicle: (name, userId) => {
        set((state) => ({
          vehicles: [...state.vehicles, name],
        }));
        if (userId) {
          queueGarageSync('vehicles', 'upsert', { name, user_id: userId });
        }
      },
      editVehicle: (oldName, newName, userId) => {
        set((state) => ({
          vehicles: state.vehicles.map((v) => (v === oldName ? newName : v)),
          fills: state.fills.map((f) => (f.vehicle === oldName ? { ...f, vehicle: newName } : f)),
          maintenance: state.maintenance.map((m) => (m.vehicle === oldName ? { ...m, vehicle: newName } : m)),
        }));
        if (userId) {
          queueGarageSync('vehicles', 'upsert', { name: newName, user_id: userId, old_name: oldName });
        }
      },
      deleteVehicle: (name, userId) => {
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v !== name),
          fills: state.fills.filter((f) => f.vehicle !== name),
          maintenance: state.maintenance.filter((m) => m.vehicle !== name),
        }));
        if (userId) {
          queueGarageSync('vehicles', 'delete', { name, user_id: userId });
        }
      },
      addFuelFill: (fill, userId) => {
        const newFill: FuelFill = {
          ...fill,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
        };
        set((state) => ({
          fills: [newFill, ...state.fills],
        }));
        if (userId) {
          queueGarageSync('fuel_fills', 'upsert', {
            id: newFill.id,
            user_id: userId,
            vehicle: newFill.vehicle,
            date: newFill.date,
            amount: newFill.amount,
            liters: newFill.liters,
            price_per_liter: newFill.pricePerLiter,
            odometer: newFill.odometer,
            station: newFill.station ?? null,
            note: newFill.note ?? null,
          });
          try {
            const { useFinanceStore } = require('../finance/store');
            addFuelTransaction(userId, newFill, useFinanceStore.getState().addTransaction);
          } catch {}
        }
        return newFill.id;
      },
      editFuelFill: (id, updated, userId) => {
        set((state) => ({
          fills: state.fills.map((f) => (f.id === id ? { ...f, ...updated } : f)),
        }));
        if (userId) {
          const fill = get().fills.find((f) => f.id === id);
          if (fill) {
            queueGarageSync('fuel_fills', 'upsert', {
              id: fill.id,
              user_id: userId,
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
        }
      },
      deleteFuelFill: (id, userId) => {
        set((state) => ({
          fills: state.fills.filter((f) => f.id !== id),
        }));
        if (userId) {
          queueGarageSync('fuel_fills', 'delete', { id, user_id: userId });
        }
      },
      addMaintenanceLog: (log, userId) => {
        const newLog: MaintenanceLog = {
          ...log,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
        };
        set((state) => ({
          maintenance: [newLog, ...state.maintenance],
        }));
        if (userId) {
          queueGarageSync('maintenance_logs', 'upsert', {
            id: newLog.id,
            user_id: userId,
            vehicle: newLog.vehicle,
            date: newLog.date,
            amount: newLog.amount,
            service_type: newLog.serviceType,
            notes: newLog.notes ?? null,
          });
        }
        return newLog.id;
      },
      editMaintenanceLog: (id, updated, userId) => {
        set((state) => ({
          maintenance: state.maintenance.map((m) => (m.id === id ? { ...m, ...updated } : m)),
        }));
        if (userId) {
          const log = get().maintenance.find((m) => m.id === id);
          if (log) {
            queueGarageSync('maintenance_logs', 'upsert', {
              id: log.id,
              user_id: userId,
              vehicle: log.vehicle,
              date: log.date,
              amount: log.amount,
              service_type: log.serviceType,
              notes: log.notes ?? null,
            });
          }
        }
      },
      deleteMaintenanceLog: (id, userId) => {
        set((state) => ({
          maintenance: state.maintenance.filter((m) => m.id !== id),
        }));
        if (userId) {
          queueGarageSync('maintenance_logs', 'delete', { id, user_id: userId });
        }
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
      name: 'meridian-garage-storage-v8', // Do NOT bump — preserves data across updates
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
