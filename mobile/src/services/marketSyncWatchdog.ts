/**
 * marketSyncWatchdog — one notification per day when the market data
 * (Kite holdings / mutual fund NAV) has not synced since the previous
 * trading day.
 *
 * Rules:
 *  - Never on Saturday or Sunday (market holidays).
 *  - At most ONE notification per calendar day — the notification carries a
 *    day-keyed dedup key and a persisted "already notified" marker, so
 *    repeated app opens never stack copies.
 *  - Mutual fund NAV for a day is published the NEXT morning, so the
 *    expectation is "refreshed on or after the previous trading day" —
 *    never "today". A missing NAV for today is normal, not stale.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInvestmentsStore } from '../modules/equity/store';
import { scheduleImmediate } from './notificationService';

const NOTIFIED_KEY = 'meridian-market-sync-notified-date';

/** IST day key (YYYY-MM-DD) — safe from any runtime timezone. */
export function istDayKey(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Saturday/Sunday (market holidays) for an IST day key. */
export function isWeekendDayKey(dayKey: string): boolean {
  const dow = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** The previous trading day (weekday) as an IST day key. */
export function previousTradingDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export interface MarketSyncState {
  /** Kite holdings have not synced since the previous trading day */
  kiteStale: boolean;
  /** Mutual fund NAV has not refreshed since the previous trading day */
  mfStale: boolean;
  /** IST day key of the last Kite sync (null when never synced) */
  lastKiteSyncKey: string | null;
  /** IST day key of the last NAV/price refresh (null when never refreshed) */
  lastNavUpdateKey: string | null;
}

/**
 * Pure freshness check. A holding counts as fresh when it was synced or
 * refreshed on or after the previous trading day — data from today or
 * yesterday is fine, anything older is stale.
 */
export function evaluateMarketSyncFreshness(input: {
  holdings: Array<{
    type: string;
    source?: string;
    lastSyncedAt?: string | null;
    updatedAt?: string | null;
  }>;
  todayKey: string;
}): MarketSyncState {
  const { holdings, todayKey } = input;
  const bar = previousTradingDayKey(todayKey);

  const dayOf = (iso?: string | null): string | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;
    return istDayKey(new Date(t));
  };

  let lastKiteSyncKey: string | null = null;
  let lastNavUpdateKey: string | null = null;
  let hasKiteHoldings = false;
  let hasMfHoldings = false;

  for (const h of holdings) {
    if (h.source === 'kite_sync') {
      hasKiteHoldings = true;
      const k = dayOf(h.lastSyncedAt);
      if (k && (!lastKiteSyncKey || k > lastKiteSyncKey)) lastKiteSyncKey = k;
    }
    if (h.type === 'mf' || h.type === 'etf') {
      hasMfHoldings = true;
      const k = dayOf(h.updatedAt);
      if (k && (!lastNavUpdateKey || k > lastNavUpdateKey)) lastNavUpdateKey = k;
    }
  }

  return {
    // No Kite-linked holdings → nothing to complain about.
    kiteStale: hasKiteHoldings && (!lastKiteSyncKey || lastKiteSyncKey < bar),
    // No MF/ETF holdings → nothing to complain about.
    mfStale: hasMfHoldings && (!lastNavUpdateKey || lastNavUpdateKey < bar),
    lastKiteSyncKey,
    lastNavUpdateKey,
  };
}

/**
 * Check the market data and fire at most one notification per day.
 * Safe to call on every app open — it no-ops on weekends, when the data is
 * fresh, or when today's notification was already sent.
 */
export async function runMarketSyncWatchdog(now: Date = new Date()): Promise<void> {
  try {
    const todayKey = istDayKey(now);
    if (isWeekendDayKey(todayKey)) return; // Saturday/Sunday — no market

    const lastNotified = await AsyncStorage.getItem(NOTIFIED_KEY);
    if (lastNotified === todayKey) return; // already notified today

    const holdings = useInvestmentsStore.getState().holdings;
    if (!holdings || holdings.length === 0) return;

    const state = evaluateMarketSyncFreshness({ holdings, todayKey });
    if (!state.kiteStale && !state.mfStale) return;

    const bar = previousTradingDayKey(todayKey);
    const barLabel = bar.split('-').reverse().join('/');

    const reasons: string[] = [];
    if (state.kiteStale) {
      reasons.push(
        state.lastKiteSyncKey
          ? `Kite holdings last synced ${state.lastKiteSyncKey} (expected on/after ${barLabel})`
          : 'Kite holdings have never synced'
      );
    }
    if (state.mfStale) {
      reasons.push(
        state.lastNavUpdateKey
          ? `MF NAV last updated ${state.lastNavUpdateKey} (expected on/after ${barLabel})`
          : 'MF NAV has never been updated'
      );
    }

    // Mark before scheduling so a crash can't fire a second copy.
    await AsyncStorage.setItem(NOTIFIED_KEY, todayKey);

    await scheduleImmediate(
      '\u{1F4C8} Market data not syncing',
      `${reasons.join('. ')}. Open Meridian to refresh — you will not be warned again today.`,
      'portfolio',
      { screen: 'InvestmentsDashboard', dedupKey: `market_sync_${todayKey}` }
    );
  } catch (e) {
    console.warn('[marketSyncWatchdog] check failed:', e);
  }
}
