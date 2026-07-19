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
  if (!storage) return;
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

export async function processSyncQueue(): Promise<{ succeeded: number; failed: number; dropped: number }> {
  const items = await dequeueAll();
  if (items.length === 0) return { succeeded: 0, failed: 0, dropped: 0 };

  const { supabase } = require("./supabaseClient");

  let succeeded = 0;
  let failed = 0;
  let dropped = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRIES) {
      dropped++;
      continue;
    }

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
          .upsert({ ...item.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (error) throw error;
      }
      succeeded++;
    } catch {
      const backoffSeconds = Math.min(60, Math.pow(2, item.retryCount) * 5);
      await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
      await enqueueWithRetry(item.entity, item.action, item.data, item.retryCount + 1);
      failed++;
    }
  }

  return { succeeded, failed, dropped };
}

async function enqueueWithRetry(
  entity: string,
  action: SyncQueueItem["action"],
  data: Record<string, unknown>,
  retryCount: number
): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  const item: SyncQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    entity,
    action,
    data,
    queuedAt: new Date().toISOString(),
    retryCount,
  };
  const raw = await storage.getItem(SYNC_QUEUE_KEY);
  const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
  queue.push(item);
  await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}
