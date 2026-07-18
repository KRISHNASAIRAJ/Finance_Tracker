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

interface GarageState {
  vehicles: string[];
  fills: FuelFill[];
  maintenance: MaintenanceLog[];
  addVehicle: (name: string) => void;
  addFuelFill: (fill: Omit<FuelFill, 'id' | 'date'>) => void;
  editFuelFill: (id: string, updated: Partial<FuelFill>) => void;
  addMaintenanceLog: (log: Omit<MaintenanceLog, 'id' | 'date'>) => void;
  getVehicleFills: (vehicle: string) => FuelFill[];
  getVehicleSpendTotal: (vehicle: string) => number;
}

const rupeeToPaise = (val: number) => Math.round(val * 100);

export const useGarageStore = create<GarageState>()(
  persist(
    (set, get) => ({
      vehicles: ['Jupiter 125'], // Single vehicle renamed to Jupiter 125 as requested
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
      addVehicle: (name) => {
        set((state) => ({
          vehicles: [...state.vehicles, name],
        }));
      },
      addFuelFill: (fill) => {
        const newFill: FuelFill = {
          ...fill,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
        };
        set((state) => ({
          fills: [newFill, ...state.fills],
        }));
      },
      editFuelFill: (id, updated) => {
        set((state) => ({
          fills: state.fills.map((f) => (f.id === id ? { ...f, ...updated } : f)),
        }));
      },
      addMaintenanceLog: (log) => {
        const newLog: MaintenanceLog = {
          ...log,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
        };
        set((state) => ({
          maintenance: [newLog, ...state.maintenance],
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
      name: 'meridian-garage-storage-v8', // v8: renamed vehicle to Jupiter 125
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
