import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import type { FuelFill, MaintenanceLog } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasSeeded = false;

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
    synced.current = true;
    doPull(
      (s: Partial<SyncState>) => setState((prev) => ({ ...prev, ...s })),
      user.id
    );
  }, [user]);

  return state;
}

function getStore() {
  const storeModule = require("../store");
  return storeModule.useGarageStore;
}

async function doPull(
  setState: (s: Partial<SyncState>) => void,
  userId: string
) {
  // fuel_fills
  const { data: fillData, error: fillError } = await supabase
    .from("fuel_fills")
    .select("*")
    .eq("user_id", userId);

  if (fillError) {
    setState({ loading: false, error: `fuel_fills: ${fillError.message}` });
    return;
  }

  if (fillData && fillData.length > 0) {
    const store = getStore();
    const state = store.getState();
    const existingIds = new Set(state.fills.map((f: FuelFill) => f.id));
    const newFills: FuelFill[] = (fillData as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
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
    if (newFills.length > 0) {
      store.setState({ fills: [...newFills, ...state.fills] });
    }
  } else if (!_hasSeeded) {
    await seedFuelFills(userId);
  }

  // maintenance_logs
  const { data: maintData, error: maintError } = await supabase
    .from("maintenance_logs")
    .select("*")
    .eq("user_id", userId);

  if (maintError) {
    setState({ loading: false, error: `maintenance_logs: ${maintError.message}` });
    return;
  }

  if (maintData && maintData.length > 0) {
    const store = getStore();
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
  } else if (!_hasSeeded) {
    await seedMaintenanceLogs(userId);
  }

  _hasSeeded = true;
  setState({ loading: false, error: null, lastSyncAt: new Date() });
}

async function seedFuelFills(userId: string) {
  const store = getStore();
  const state = store.getState();
  const items = state.fills as FuelFill[];
  if (items.length === 0) return;
  const rows = items.map((f) => ({
    id: f.id,
    user_id: userId,
    vehicle: f.vehicle,
    date: f.date,
    amount: f.amount,
    liters: f.liters,
    price_per_liter: f.pricePerLiter,
    odometer: f.odometer,
    station: f.station ?? null,
    note: f.note ?? null,
  }));
  supabase.from("fuel_fills").upsert(rows, { onConflict: "id" }).then(() => {});
}

async function seedMaintenanceLogs(userId: string) {
  const store = getStore();
  const state = store.getState();
  const items = state.maintenance as MaintenanceLog[];
  if (items.length === 0) return;
  const rows = items.map((m) => ({
    id: m.id,
    user_id: userId,
    vehicle: m.vehicle,
    date: m.date,
    amount: m.amount,
    service_type: m.serviceType,
    notes: m.notes ?? null,
  }));
  supabase.from("maintenance_logs").upsert(rows, { onConflict: "id" }).then(() => {});
}
