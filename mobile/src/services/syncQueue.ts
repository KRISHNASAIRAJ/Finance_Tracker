/**
 * syncQueue — Offline-first write queue with retry/backoff, persisted to AsyncStorage.
 * Data safety: items are NEVER dropped. They stay queued with exponential backoff
 * until a sync succeeds, so local changes are never lost.
 *
 * v2 hardening:
 *  - `processSyncQueue(force = true)` ignores backoff pacing so a manual "Sync
 *    Now" actually retries immediately instead of silently skipping items.
 *  - Fixes a data-loss race: items enqueued while a process run is in flight
 *    were overwritten by `saveQueue(remaining)`. Now remaining items are merged
 *    with whatever was added during processing.
 *  - Compacts the queue to one operation per (entity, id) before processing, so
 *    stale intermediate ops can never overwrite newer data and the queue cannot
 *    balloon out of control.
 *  - Exposes `getPendingEntityIds()` so cloud pulls can protect rows that still
 *    have unsynced local changes (prevents old data resurrecting over edits).
 */

const SYNC_QUEUE_KEY = "meridian_sync_queue";

/** Soft cap for retry bookkeeping (never drops items, only paces retries). */
const MAX_RETRIES = 50;

/** Cap backoff at 1 hour between attempts. */
const MAX_BACKOFF_MS = 60 * 60 * 1000;

interface SyncQueueItem {
  id: string;
  entity: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  queuedAt: string;
  retryCount: number;
  /** ISO timestamp — item is skipped until this time (backoff pacing). */
  nextAttemptAt?: string;
}

let AsyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null = null;

const getStorage = () => {
  if (AsyncStorage) return AsyncStorage;
  try {
    // Dynamic require avoids a circular dependency (stores import syncQueue)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AsyncStorage = require("@react-native-async-storage/async-storage").default;
  } catch {
    AsyncStorage = null;
  }
  return AsyncStorage;
};

export async function enqueue(entity: string, action: SyncQueueItem["action"], data: Record<string, unknown>): Promise<void> {
  const storage = getStorage();
  if (!storage) {
    console.warn('[SyncQueue] enqueue failed: AsyncStorage unavailable');
    return;
  }
  const item: SyncQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    entity,
    action,
    data,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };
  const raw = await storage.getItem(SYNC_QUEUE_KEY);
  const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
  queue.push(item);
  await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function dequeueAll(): Promise<SyncQueueItem[]> {
  const storage = getStorage();
  if (!storage) return [];
  const raw = await storage.getItem(SYNC_QUEUE_KEY);
  if (!raw) return [];
  await storage.removeItem(SYNC_QUEUE_KEY);
  return JSON.parse(raw);
}

export async function getQueue(): Promise<SyncQueueItem[]> {
  const storage = getStorage();
  if (!storage) return [];
  const raw = await storage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue(): Promise<void> {
  const storage = getStorage();
  if (storage) {
    await storage.removeItem(SYNC_QUEUE_KEY);
  }
}

let _processing = false;

export interface SyncStatus {
  lastResult: { succeeded: number; failed: number; dropped: number } | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  queueCount: number;
  isProcessing: boolean;
}

const _status: SyncStatus = {
  lastResult: null,
  lastError: null,
  lastAttemptAt: null,
  queueCount: 0,
  isProcessing: false,
};

const _statusListeners: Set<(s: SyncStatus) => void> = new Set();

export function onSyncStatusChange(cb: (s: SyncStatus) => void): () => void {
  _statusListeners.add(cb);
  return () => _statusListeners.delete(cb);
}

function emitStatus() {
  _statusListeners.forEach((cb) => {
    try {
      cb({ ..._status });
    } catch {
      // Listener errors must not break the sync pipeline
    }
  });
}

export function getSyncStatus(): SyncStatus {
  return { ..._status };
}

async function saveQueue(queue: SyncQueueItem[]): Promise<void> {
  const storage = getStorage();
  if (storage) {
    if (queue.length === 0) {
      await storage.removeItem(SYNC_QUEUE_KEY);
    } else {
      await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  }
}

async function refreshQueueCount() {
  const items = await getQueue();
  _status.queueCount = items.length;
  emitStatus();
}

/**
 * Column-name normalization per entity: maps local camelCase fields to the
 * snake_case DB columns PostgREST expects. Historic queue items (e.g. a
 * transaction enqueued with `paymentMode`) fail silently against the schema
 * cache, so every payload is normalized before it hits Supabase. Unknown
 * keys are dropped so a single bad column can never wedge an item forever.
 */
const FIELD_ALIASES: Record<string, Record<string, string>> = {
  transactions: {
    paymentMode: 'payment_mode',
    linkedCardId: 'linked_card_id',
    linkedVehicleId: 'linked_vehicle_id',
    linkedHoldingId: 'linked_holding_id',
    linkedAccountId: 'linked_account_id',
  },
  credit_cards: {
    endingWith: 'ending_with',
    billingDay: 'billing_day',
    dueDate: 'due_date',
    cardLimit: 'card_limit',
    currentOutstanding: 'current_outstanding',
    billAmount: 'bill_amount',
    paidAmount: 'paid_amount',
    annualCharge: 'annual_charge',
    annualChargeDate: 'annual_charge_date',
    isLtf: 'is_ltf',
  },
  bank_accounts: {},
  receivables: {
    personName: 'person_name',
    paidAmount: 'paid_amount',
    dueDate: 'due_date',
  },
  fixed_expenses: {
    billingDay: 'billing_day',
    lastPaidMonth: 'last_paid_month',
    dueDate: 'due_date',
  },
  payzapp_loads: {},
  expected_incomes: {},
  category_budgets: {
    amountPaise: 'amount_paise',
  },
  user_settings: {},
  holdings: {
    avgPrice: 'avg_buy_price',
    currentPrice: 'current_price',
    prevClose: 'prev_close',
    currentValue: 'current_value',
    fundName: 'fund_name',
    folio: 'folio_number',
    schemeCode: 'scheme_code',
    sipAmount: 'sip_amount',
    sipDay: 'sip_day',
    allocation: 'allocation_category',
  },
  investment_goals: {
    goalName: 'goal_name',
    targetAmount: 'target_amount',
    currentProgress: 'current_progress',
    targetDate: 'target_date',
    linkedHoldingIds: 'linked_holding_ids',
  },
  tasks: {
    dueDate: 'due_date',
    isCompleted: 'is_completed',
    completedAt: 'completed_at',
  },
  loans: {},
  notes: {},
  goals: {},
  recipes: {
    prepTime: 'prep_time',
  },
  diet_plans: {},
  fuel_fills: {
    pricePerLiter: 'price_per_liter',
  },
  maintenance_logs: {},
  vehicles: {},
  meal_logs: {},
  weight_logs: {
    weightKg: 'weight_kg',
  },
  career_events: {},
  weekly_diary: {},
};

function normalizePayload(entity: string, raw: Record<string, unknown>): Record<string, unknown> {
  const aliases = FIELD_ALIASES[entity];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id') {
      out.id = value;
      continue;
    }
    const mapped = aliases ? (aliases[key] ?? key) : key;
    if (aliases && !aliases[key] && /[A-Z]/.test(key)) {
      // camelCase key with no alias — not a valid DB column, skip it
      continue;
    }
    out[mapped] = value;
  }
  return out;
}

/**
 * Some tables are keyed by something other than `id` (vehicles is deduped by
 * user_id+name). Upserts use the right conflict target per entity so they can
 * never wedge on a unique-constraint violation.
 */
const ON_CONFLICT_TARGET: Record<string, string> = {
  vehicles: 'user_id,name',
  user_settings: 'user_id',
};

/**
 * Collapse the queue to ONE operation per (entity, id) before processing.
 * This guarantees the newest local intent wins and stale intermediate writes
 * can never clobber newer data on the cloud after a retry.
 *
 * Merging rules (last write wins, oldest → newest):
 *  - If the newest op for a row is `delete`, only the delete is kept.
 *  - Otherwise all ops are merged; payloads are layered in order so the merged
 *    item carries the full intended row state. If any op in the group was a
 *    `create` (full row), the merged action stays `create` (upsert). If the
 *    group only ever had partial `update`s, it stays `update`.
 */
function compactQueue(items: SyncQueueItem[]): SyncQueueItem[] {
  if (items.length <= 1) return items;

  const groups = new Map<string, SyncQueueItem[]>();
  const order: string[] = [];
  for (const item of items) {
    const id = item.data?.id as string | undefined;
    if (!id) {
      // No id — cannot group; keep as-is
      order.push(`__solo__${item.id}`);
      groups.set(`__solo__${item.id}`, [item]);
      continue;
    }
    const key = `${item.entity}\u0000${id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  const out: SyncQueueItem[] = [];
  for (const key of order) {
    const ops = groups.get(key)!;
    if (ops.length === 1) {
      out.push(ops[0]);
      continue;
    }

    const latest = ops[ops.length - 1];
    if (latest.action === 'delete') {
      out.push(latest);
      continue;
    }

    let mergedData: Record<string, unknown> = {};
    let hasCreate = false;
    let finalAction: SyncQueueItem["action"] = latest.action;
    for (const op of ops) {
      if (op.action === 'create') hasCreate = true;
      if (op.action === 'delete') continue;
      mergedData = { ...mergedData, ...op.data };
    }
    if (hasCreate) finalAction = 'create';

    out.push({
      ...latest,
      action: finalAction,
      data: mergedData,
      retryCount: 0,
      nextAttemptAt: undefined,
    });
  }
  return out;
}

/**
 * Rows that still have unsynced local operations in the queue.
 * Returns a Set of `entity|id` strings. Cloud pulls must NOT overwrite these
 * rows (their local state is newer and still waiting to sync), otherwise old
 * data resurrects over the user's edits.
 */
export async function getPendingEntityIds(): Promise<Set<string>> {
  const items = await getQueue();
  const out = new Set<string>();
  for (const item of items) {
    const id = item.data?.id as string | undefined;
    if (id) out.add(`${item.entity}|${id}`);
  }
  return out;
}

export async function processSyncQueue(force = false): Promise<{ succeeded: number; failed: number; dropped: number; error?: string }> {
  if (_processing) return { succeeded: 0, failed: 0, dropped: 0, error: 'Sync already in progress' };
  _processing = true;
  _status.isProcessing = true;
  _status.lastAttemptAt = new Date().toISOString();
  emitStatus();

  try {
    const rawItems = await getQueue();

    if (rawItems.length === 0) {
      _status.lastResult = { succeeded: 0, failed: 0, dropped: 0 };
      _status.lastError = null;
      _status.queueCount = 0;
      _status.isProcessing = false;
      emitStatus();
      return { succeeded: 0, failed: 0, dropped: 0 };
    }

    // Dynamic require avoids a circular dependency with supabaseClient
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require("./supabaseClient");

    let sessionUser: { id: string } | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      sessionUser = session?.user ?? null;
    } catch {
      // Session read failed — try refreshing below
    }

    if (!sessionUser) {
      try {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        sessionUser = refreshedSession?.user ?? null;
      } catch (refreshErr: any) {
        console.warn('[SyncQueue] Session refresh failed:', refreshErr?.message ?? refreshErr);
      }
    }

    if (!sessionUser) {
      const errMsg = 'Not signed in — sync requires authentication. Please sign in to sync your data.';
      _status.lastError = errMsg;
      _status.lastResult = { succeeded: 0, failed: rawItems.length, dropped: 0 };
      _status.isProcessing = false;
      _processing = false;
      emitStatus();
      console.warn('[SyncQueue]', errMsg);
      return { succeeded: 0, failed: rawItems.length, dropped: 0, error: errMsg };
    }

    // Compact the queue (oldest → newest intent wins), and when force is set,
    // clear backoff pacing so every item is attempted right now.
    let items = compactQueue(rawItems);
    if (force) {
      items = items.map((item) => ({ ...item, retryCount: 0, nextAttemptAt: undefined }));
    }

    let succeeded = 0;
    let failed = 0;
    const dropped = 0;
    const remaining: SyncQueueItem[] = [];
    const errorMessages: string[] = [];
    const now = Date.now();

    for (const item of items) {
      // Backoff pacing — skip items not yet due for retry (only when not forced)
      if (!force && item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now) {
        remaining.push(item);
        continue;
      }

      // Never drop items — keep retrying with backoff. The retryCount
      // is informational only (< MAX_RETRIES prevents unbounded counters).
      if (item.retryCount >= MAX_RETRIES) {
        // Reset retry count so it keeps trying, just with backoff
        item.retryCount = 0;
      }

      const normalized = normalizePayload(item.entity, item.data);
      const resolvedData = {
        ...normalized,
        user_id: normalized.user_id || sessionUser.id,
        updated_at: new Date().toISOString(),
      };

      try {
        if (item.action === "delete") {
          // vehicles is name-keyed (no stable local id) — delete by name.
          if (item.entity === 'vehicles') {
            const { error } = await supabase
              .from(item.entity)
              .delete()
              .eq("name", item.data.name as string)
              .eq("user_id", item.data.user_id as string);
            if (error) {
              errorMessages.push(`delete ${item.entity}/${item.data.name}: ${error.message}`);
              throw error;
            }
          } else {
            const { error } = await supabase
              .from(item.entity)
              .delete()
              .eq("id", item.data.id as string);
            if (error) {
              errorMessages.push(`delete ${item.entity}/${item.data.id}: ${error.message}`);
              throw error;
            }
          }
        } else if (item.action === "update") {
          // UPDATE by id — partial rows (e.g. card balance, paid amount)
          // must NOT go through upsert, whose INSERT branch fails on
          // NOT NULL columns not present in the payload.
          const normalizedUpdate = normalizePayload(item.entity, item.data);
          const fields: Record<string, unknown> = {
            ...normalizedUpdate,
            user_id: normalizedUpdate.user_id || sessionUser.id,
            updated_at: new Date().toISOString(),
          };
          delete fields.id;
          const { error } = await supabase
            .from(item.entity)
            .update(fields)
            .eq("id", item.data.id as string);
          if (error) {
            errorMessages.push(`update ${item.entity}/${item.data.id}: ${error.message}`);
            throw error;
          }
        } else {
          const conflictTarget = ON_CONFLICT_TARGET[item.entity] ?? "id";
          const { error } = await supabase
            .from(item.entity)
            .upsert(resolvedData, { onConflict: conflictTarget });
          if (error) {
            errorMessages.push(`${item.action} ${item.entity}/${item.data.id ?? ''}: ${error.message}`);
            throw error;
          }
        }
        succeeded++;
      } catch (e: any) {
        console.warn(`[SyncQueue] ${item.action} failed for ${item.entity}/${item.data.id}:`, e?.message ?? e);
        const backoffMs = Math.min(Math.pow(2, item.retryCount) * 1000, MAX_BACKOFF_MS);
        remaining.push({
          ...item,
          retryCount: item.retryCount + 1,
          nextAttemptAt: new Date(Date.now() + backoffMs).toISOString(),
        });
        failed++;
      }
    }

    // CRITICAL — never overwrite items enqueued while we were processing, and
    // never re-add items from THIS run (they are already handled above: the
    // successes are done, the failures live in `remaining`).
    // Items that were already in storage at the start of the run are filtered
    // out; only genuinely new items (added mid-run) are kept and appended AFTER
    // the failed ones so intent order is preserved.
    const rawIds = new Set(rawItems.map((i) => i.id));
    const newlyAdded = (await getQueue()).filter((i) => !rawIds.has(i.id));
    const newIds = new Set(newlyAdded.map((i) => i.id));
    const merged: SyncQueueItem[] = [
      ...remaining.filter((r) => !newIds.has(r.id)),
      ...newlyAdded,
    ];

    await saveQueue(merged);
    _status.lastResult = { succeeded, failed, dropped };
    _status.lastError = errorMessages.length > 0 ? errorMessages.join('; ') : null;
    _status.queueCount = merged.length;
    _status.isProcessing = false;
    emitStatus();

    return { succeeded, failed, dropped, error: errorMessages.length > 0 ? errorMessages.join('; ') : undefined };
  } catch (fatalErr: any) {
    const fatalMsg = fatalErr?.message ?? String(fatalErr);
    _status.lastError = `Sync crashed: ${fatalMsg}`;
    _status.lastResult = null;
    _status.isProcessing = false;
    emitStatus();
    return { succeeded: 0, failed: 0, dropped: 0, error: fatalMsg };
  } finally {
    _processing = false;
  }
}

refreshQueueCount();
