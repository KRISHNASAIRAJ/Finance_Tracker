/**
 * syncQueue — Offline-first write queue with retry/backoff, persisted to AsyncStorage.
 * Data safety: items are NEVER dropped. They stay queued with exponential backoff
 * until a sync succeeds, so local changes are never lost.
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

export async function processSyncQueue(): Promise<{ succeeded: number; failed: number; dropped: number; error?: string }> {
  if (_processing) return { succeeded: 0, failed: 0, dropped: 0, error: 'Sync already in progress' };
  _processing = true;
  _status.isProcessing = true;
  _status.lastAttemptAt = new Date().toISOString();
  emitStatus();

  try {
    const items = await getQueue();
    _status.queueCount = items.length;

    if (items.length === 0) {
      _status.lastResult = { succeeded: 0, failed: 0, dropped: 0 };
      _status.lastError = null;
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
      _status.lastResult = { succeeded: 0, failed: items.length, dropped: 0 };
      _status.isProcessing = false;
      _processing = false;
      emitStatus();
      console.warn('[SyncQueue]', errMsg);
      return { succeeded: 0, failed: items.length, dropped: 0, error: errMsg };
    }

    let succeeded = 0;
    let failed = 0;
    const dropped = 0;
    const remaining: SyncQueueItem[] = [];
    const errorMessages: string[] = [];
    const now = Date.now();

    for (const item of items) {
      // Backoff pacing — skip items not yet due for retry
      if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now) {
        remaining.push(item);
        continue;
      }

      // Never drop items — keep retrying with backoff. The retryCount
      // is informational only (< MAX_RETRIES prevents unbounded counters).
      if (item.retryCount >= MAX_RETRIES) {
        // Reset retry count so it keeps trying, just with backoff
        item.retryCount = 0;
      }

      const resolvedData = {
        ...item.data,
        user_id: item.data.user_id || sessionUser.id,
        updated_at: new Date().toISOString(),
      };

      try {
        if (item.action === "delete") {
          const { error } = await supabase
            .from(item.entity)
            .delete()
            .eq("id", item.data.id as string);
          if (error) {
            errorMessages.push(`delete ${item.entity}/${item.data.id}: ${error.message}`);
            throw error;
          }
        } else if (item.action === "update") {
          // UPDATE by id — partial rows (e.g. card balance, paid amount)
          // must NOT go through upsert, whose INSERT branch fails on
          // NOT NULL columns not present in the payload.
          const { id, ...fields } = resolvedData;
          const { error } = await supabase
            .from(item.entity)
            .update(fields)
            .eq("id", id as string);
          if (error) {
            errorMessages.push(`update ${item.entity}/${item.data.id}: ${error.message}`);
            throw error;
          }
        } else {
          const { error } = await supabase
            .from(item.entity)
            .upsert(resolvedData, { onConflict: "id" });
          if (error) {
            errorMessages.push(`${item.action} ${item.entity}/${item.data.id}: ${error.message}`);
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

    await saveQueue(remaining);
    _status.lastResult = { succeeded, failed, dropped };
    _status.lastError = errorMessages.length > 0 ? errorMessages.join('; ') : null;
    _status.queueCount = remaining.length;
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
