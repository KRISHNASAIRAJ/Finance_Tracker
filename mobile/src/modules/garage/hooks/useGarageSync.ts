import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import type { FuelFill, MaintenanceLog } from "../store";
import { BACKUP_VEHICLES, BACKUP_FILLS, BACKUP_MAINTENANCE } from "./backupData";
import { useGarageStore } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasSeeded = false;
let _fuelCleanupRan = false;

export function useGarageSync() {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    loading: true,
    error: null,
    lastSyncAt: null,
  });
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;

    const hydrateAndSync = () => {
      if (synced.current) return;
      synced.current = true;
      if (!_fuelCleanupRan) {
        _fuelCleanupRan = true;
        try {
          const { useFinanceStore } = require('../../finance/store');
          const financeState = useFinanceStore.getState();
          const cleaned = financeState.transactions.filter(
            (t: { type: string }) => t.type !== 'fuel_purchase'
          );
          if (cleaned.length !== financeState.transactions.length) {
            useFinanceStore.setState({ transactions: cleaned });
          }
        } catch (e) { console.warn('[GarageSync] fuel cleanup failed:', e); }
      }
      doFullSync(user.id);
    };

    if (useGarageStore.persist.hasHydrated()) {
      hydrateAndSync();
    } else {
      const unsub = useGarageStore.persist.onFinishHydration(() => {
        hydrateAndSync();
      });
      return unsub;
    }
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    _hasSeeded = true;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

async function doFullSync(userId: string) {
  const store = useGarageStore;
  const state = store.getState();
  const isStoreEmpty = state.vehicles.length === 0 && state.fills.length === 0 && state.maintenance.length === 0;

  if (isStoreEmpty) {
    store.setState({
      vehicles: BACKUP_VEHICLES,
      fills: BACKUP_FILLS,
      maintenance: BACKUP_MAINTENANCE,
    });
    await Promise.all([
      seedFuelFills(userId),
      seedMaintenanceLogs(userId),
      seedVehicles(userId),
    ]);
  }

  await doPull(userId);
  _hasSeeded = true;
}

async function doPull(userId: string) {
  // fuel_fills
  const { data: fillData, error: fillError } = await supabase
    .from("fuel_fills")
    .select("*")
    .eq("user_id", userId);

  if (!fillError && fillData && fillData.length > 0) {
    const store = useGarageStore;
    const merged: FuelFill[] = (fillData as Array<Record<string, unknown>>)
      .map((r) => ({
        id: r.id as string,
        vehicle: r.vehicle as string ?? "",
        date: r.date as string ?? "",
        amount: r.amount as number ?? 0,
        liters: Number(r.liters) ?? 0,
        pricePerLiter: r.price_per_liter as number ?? 0,
        odometer: r.odometer as number ?? 0,
        station: r.station as string ?? undefined,
        note: r.note as string ?? undefined,
      }));
    store.setState({ fills: merged });
  } else if (!_hasSeeded && fillData && fillData.length === 0) {
    await seedFuelFills(userId);
  }

  // maintenance_logs
  const { data: maintData, error: maintError } = await supabase
    .from("maintenance_logs")
    .select("*")
    .eq("user_id", userId);

  if (!maintError && maintData && maintData.length > 0) {
    const store = useGarageStore;
    const state = store.getState();
    const existingIds = new Set(state.maintenance.map((m: MaintenanceLog) => m.id));
    const newMaint: MaintenanceLog[] = (maintData as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .map((r) => ({
        id: r.id as string,
        vehicle: r.vehicle as string ?? "",
        date: r.date as string ?? "",
        amount: r.amount as number ?? 0,
        serviceType: r.service_type as string ?? "",
        notes: r.notes as string ?? undefined,
      }));
    if (newMaint.length > 0) {
      store.setState({ maintenance: [...newMaint, ...state.maintenance] });
    }
  } else if (!_hasSeeded && maintData && maintData.length === 0) {
    await seedMaintenanceLogs(userId);
  }

  // vehicles — query Supabase, but vehicles table may not exist; skip on error
  const { data: vehicleData, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId);

  if (!vehicleError && vehicleData && vehicleData.length > 0) {
    const store = useGarageStore;
    const state = store.getState();
    const cloudNames = (vehicleData as Array<Record<string, unknown>>).map((r) => r.name as string);
    const merged = [...new Set([...state.vehicles, ...cloudNames])];
    if (merged.length !== state.vehicles.length) {
      store.setState({ vehicles: merged });
    }
  } else if (!_hasSeeded && vehicleData && vehicleData.length === 0) {
    await seedVehicles(userId);
  }
}

export function GarageSyncInitializer() {
  useGarageSync();
  return null;
}

async function seedFuelFills(userId: string) {
  const store = useGarageStore;
  const state = store.getState();
  const items = state.fills as FuelFill[];
  if (items.length === 0) return;
  const rows = items.map((f) => ({
    id: f.id, user_id: userId, vehicle: f.vehicle, date: f.date,
    amount: f.amount, liters: f.liters, price_per_liter: f.pricePerLiter,
    odometer: f.odometer, station: f.station ?? null, note: f.note ?? null,
  }));
  supabase.from("fuel_fills").upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn('[GarageSync] seed fuel_fills:', error.message);
  });
}

async function seedMaintenanceLogs(userId: string) {
  const store = useGarageStore;
  const state = store.getState();
  const items = state.maintenance as MaintenanceLog[];
  if (items.length === 0) return;
  const rows = items.map((m) => ({
    id: m.id, user_id: userId, vehicle: m.vehicle, date: m.date,
    amount: m.amount, service_type: m.serviceType, notes: m.notes ?? null,
  }));
  supabase.from("maintenance_logs").upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn('[GarageSync] seed maintenance_logs:', error.message);
  });
}

async function seedVehicles(userId: string) {
  const store = useGarageStore;
  const state = store.getState();
  const items = state.vehicles as string[];
  if (items.length === 0) return;
  const rows = items.map((v) => ({
    id: Math.random().toString(36).substring(2, 9),
    user_id: userId, name: v,
  }));
  supabase.from("vehicles").upsert(rows).then(({ error }) => {
    if (error) console.warn('[GarageSync] seed vehicles:', error.message);
  });
}
