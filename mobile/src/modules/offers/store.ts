/**
 * OffersStore — Zustand store for discount offers / coupons with offline sync
 * queue support. Mirrors the sleepStore pattern: local-first writes + sync
 * queue enqueue, plus offer-expiry reminders rescheduled on every CRUD.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Offer {
  id: string;
  title: string;
  merchant: string;
  category: string;
  couponCode: string;
  discountValue: string;
  /** minimum spend in paise (null = none) */
  minSpendPaise: number | null;
  /** expiry date, IST day — YYYY-MM-DD */
  expiresOn: string;
  notes: string;
}

interface OffersState {
  offers: Offer[];
  addOffer: (offer: Omit<Offer, 'id'>, userId?: string) => string;
  updateOffer: (id: string, data: Partial<Offer>, userId?: string) => void;
  deleteOffer: (id: string, userId?: string) => void;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) { /* no-op */}
  }, 300);
  if (typeof t === 'object' && t && typeof (t as any).unref === 'function') {
    (t as any).unref();
  }
}

async function enq(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', data);
    flush();
  } catch (_e) { /* no-op */}
}

/** Best-effort refresh of offer-expiry reminders (3 & 2 days before, 6 PM IST). */
function refreshReminders() {
  try {
    const { refreshOfferReminders } = require('../../services/notificationService');
    refreshOfferReminders().catch((_e: Error) => {});
  } catch (_e) { /* no-op */}
}

function normalizeOffer(offer: Offer): Offer {
  return {
    ...offer,
    merchant: offer.merchant || '',
    category: offer.category || '',
    couponCode: offer.couponCode || '',
    discountValue: offer.discountValue || '',
    minSpendPaise: offer.minSpendPaise ?? null,
    notes: offer.notes || '',
  };
}

export function isExpired(offer: Pick<Offer, 'expiresOn'>, todayIst?: string): boolean {
  const today = todayIst ?? new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  return offer.expiresOn < today;
}

export function daysUntilExpiry(offer: Pick<Offer, 'expiresOn'>, todayIst?: string): number {
  const today = todayIst ?? new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const ms = new Date(`${offer.expiresOn}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

export const useOffersStore = create<OffersState>()(
  persist(
    (set, get) => ({
      offers: [],

      addOffer: (offer, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const full = normalizeOffer({ ...offer, id });
        set((s) => ({ offers: [full, ...s.offers] }));
        enq('offers', 'create', {
          id,
          user_id: userId || null,
          title: full.title,
          merchant: full.merchant,
          category: full.category,
          coupon_code: full.couponCode,
          discount_value: full.discountValue,
          min_spend_paise: full.minSpendPaise,
          expires_on: full.expiresOn,
          notes: full.notes,
          updated_at: new Date().toISOString(),
        });
        refreshReminders();
        return id;
      },

      updateOffer: (id, data, userId) => {
        const current = get().offers.find((o) => o.id === id);
        if (!current) return;
        const merged = normalizeOffer({ ...current, ...data, id });
        set((s) => ({ offers: s.offers.map((o) => (o.id === id ? merged : o)) }));
        enq('offers', 'create', {
          id,
          user_id: userId || null,
          title: merged.title,
          merchant: merged.merchant,
          category: merged.category,
          coupon_code: merged.couponCode,
          discount_value: merged.discountValue,
          min_spend_paise: merged.minSpendPaise,
          expires_on: merged.expiresOn,
          notes: merged.notes,
          updated_at: new Date().toISOString(),
        });
        refreshReminders();
      },

      deleteOffer: (id, userId) => {
        set((s) => ({ offers: s.offers.filter((o) => o.id !== id) }));
        enq('offers', 'delete', { id, user_id: userId || null });
        refreshReminders();
      },
    }),
    {
      name: 'meridian-offers-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
