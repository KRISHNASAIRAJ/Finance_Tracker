/**
 * useOffersSync — Supabase pull/push sync hook for the offers module.
 * Mirrors usePersonalSync: flush local queue first, protect pending rows,
 * merge cloud rows, push brand-new local-only rows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import { useOffersStore, Offer } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasOffersSeeded = false;

export function useOffersSync() {
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
    doPull(user.id).then(() => {
      _hasOffersSeeded = true;
      setState({ loading: false, error: null, lastSyncAt: new Date() });
    });
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    _hasOffersSeeded = true;
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

export async function syncOffersNow(userId: string): Promise<SyncState> {
  await doPull(userId);
  _hasOffersSeeded = true;
  return { loading: false, error: null, lastSyncAt: new Date() };
}

async function doPull(userId: string) {
  // Flush local changes to the cloud FIRST so the pull cannot resurrect stale
  // cloud data over edits the user just made.
  try {
    const { processSyncQueue } = require("../../../services/syncQueue");
    await processSyncQueue(true);
  } catch (_e) { /* will retry on next pull / CRUD */ }

  let pendingIds: Set<string> = new Set();
  try {
    const { getPendingEntityIds } = require("../../../services/syncQueue");
    pendingIds = await getPendingEntityIds();
  } catch (_e) { /* no pending protection available — proceed */ }

  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.warn('[OffersSync] pull failed:', error.message);
    return;
  }

  const store = useOffersStore;

  if (data && data.length > 0) {
    const existingIds = new Set(store.getState().offers.map((o: Offer) => o.id));
    const incoming: Offer[] = (data as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .filter((r) => !pendingIds.has(`offers|${r.id}`))
      .map((r) => ({
        id: r.id as string,
        title: (r.title as string) ?? '',
        merchant: (r.merchant as string) ?? '',
        category: (r.category as string) ?? '',
        couponCode: (r.coupon_code as string) ?? '',
        discountValue: (r.discount_value as string) ?? '',
        minSpendPaise: r.min_spend_paise === null || r.min_spend_paise === undefined
          ? null
          : Number(r.min_spend_paise) || null,
        expiresOn: (r.expires_on as string) ?? '',
        notes: (r.notes as string) ?? '',
      }))
      .filter((o) => o.expiresOn && o.title);
    if (incoming.length > 0) {
      const merged = [...incoming, ...store.getState().offers];
      merged.sort((a, b) => (a.expiresOn < b.expiresOn ? -1 : 1));
      store.setState({ offers: merged });
    }
  } else if (!_hasOffersSeeded && data && data.length === 0) {
    // Seed any local-only offers to the cloud below.
  }

  // Push local-only offers (brand-new offline entries) that are missing in cloud.
  const cloudIds = new Set((data ?? []).map((r: Record<string, unknown>) => r.id as string));
  const localOnly = store.getState().offers.filter((o) => !cloudIds.has(o.id));
  if (localOnly.length > 0) {
    const rows = localOnly.map((o) => ({
      id: o.id,
      user_id: userId,
      title: o.title,
      merchant: o.merchant || null,
      category: o.category || null,
      coupon_code: o.couponCode || null,
      discount_value: o.discountValue || null,
      min_spend_paise: o.minSpendPaise,
      expires_on: o.expiresOn,
      notes: o.notes || null,
      updated_at: new Date().toISOString(),
    }));
    supabase.from("offers").upsert(rows, { onConflict: "id" }).then(({ error: e }) => {
      if (e) console.warn('[OffersSync] pushMissing offers:', e.message);
    });
  }
}
