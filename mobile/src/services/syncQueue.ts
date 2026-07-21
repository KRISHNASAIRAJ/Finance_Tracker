const SYNC_QUEUE_KEY = "meridian_sync_queue";

const MAX_RETRIES = 5;

interface SyncQueueItem {
  id: string;
  entity: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  queuedAt: string;
  retryCount: number;
}

let AsyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null = null;

const getStorage = () => {
  if (AsyncStorage) return AsyncStorage;
  try {
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

export async function processSyncQueue(): Promise<{ succeeded: number; failed: number; dropped: number }> {
  if (_processing) return { succeeded: 0, failed: 0, dropped: 0 };
  _processing = true;

  try {
    const items = await getQueue();
    if (items.length === 0) return { succeeded: 0, failed: 0, dropped: 0 };

    const { supabase } = require("./supabaseClient");

    let sessionUser: { id: string } | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      sessionUser = session?.user ?? null;
    } catch (_) {}

    if (!sessionUser) {
      _processing = false;
      console.warn('[SyncQueue] No authenticated session — keeping items in queue until sign-in');
      return { succeeded: 0, failed: items.length, dropped: 0 };
    }

    let succeeded = 0;
    let failed = 0;
    let dropped = 0;
    const remaining: SyncQueueItem[] = [];

    for (const item of items) {
      if (item.retryCount >= MAX_RETRIES) {
        console.warn(`[SyncQueue] Dropping ${item.entity}/${item.data.id} after ${MAX_RETRIES} retries`);
        dropped++;
        continue;
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
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from(item.entity)
            .upsert(resolvedData, { onConflict: "id" });
          if (error) throw error;
        }
        succeeded++;
      } catch (e: any) {
        console.warn(`[SyncQueue] ${item.action} failed for ${item.entity}/${item.data.id}:`, e?.message ?? e);
        remaining.push({ ...item, retryCount: item.retryCount + 1 });
        failed++;
      }
    }

    await saveQueue(remaining);
    return { succeeded, failed, dropped };
  } finally {
    _processing = false;
  }
}
