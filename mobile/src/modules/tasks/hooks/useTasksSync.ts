/**
 * Tasks sync hook — bidirectional sync of tasks with Supabase, auto-creates
 * recurring task instances on load.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import type { Task, Subtask } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasSeeded = false;

export function useTasksSync() {
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
    doInitialSync(
      (s: Partial<SyncState>) => setState((prev) => ({ ...prev, ...s })),
      user.id
    );
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await doPull(user.id);
    setState((prev) => ({ ...prev, loading: false, lastSyncAt: new Date() }));
  }, [user]);

  return { ...state, pullFromCloud };
}

function getStore() {
  const storeModule = require("../store");
  return storeModule.useTasksStore;
}

async function doPull(userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.warn('[TasksSync] doPull error:', error.message);
    return;
  }

  if (!data || data.length === 0) return;

  const store = getStore();
  const localState = store.getState();
  const existingIds = new Set(localState.tasks.map((t: Task) => t.id));

  const remoteTasks: Task[] = (data as Array<Record<string, unknown>>).map((r) => {
    let subtasks: Subtask[] = [];
    try {
      if (r.subtasks && typeof r.subtasks === 'string') {
        subtasks = JSON.parse(r.subtasks as string);
      }
    } catch {}
    return {
      id: r.id as string,
      name: r.title as string ?? "",
      description: r.description as string ?? undefined,
      priority: (r.priority as string ?? "medium") as Task['priority'],
      dueDate: r.due_date as string ?? new Date().toISOString(),
      completed: (r.is_completed as boolean) ?? false,
      completedAt: (r.completed_at as string) ?? null,
      subtasks,
      recurrence: (r.recurrence as string ?? "none") as Task['recurrence'],
    };
  });

  const newRemote = remoteTasks.filter((r) => !existingIds.has(r.id));
  const remoteMap = new Map(remoteTasks.map((r) => [r.id, r]));

  if (newRemote.length > 0) {
    const merged = [...newRemote, ...localState.tasks].filter(
      (t) => remoteMap.has(t.id)
    );
    merged.forEach((t) => {
      const remote = remoteMap.get(t.id);
      if (remote) {
        t.completed = remote.completed;
        t.completedAt = remote.completedAt;
        t.name = remote.name;
        t.description = remote.description;
        t.priority = remote.priority;
        t.dueDate = remote.dueDate;
        t.subtasks = remote.subtasks;
        t.recurrence = remote.recurrence;
      }
    });
    store.setState({ tasks: merged });
  } else {
    const needsUpdate = localState.tasks.some((t: Task) => {
      const remote = remoteMap.get(t.id);
      if (!remote) return false;
      return (
        t.completed !== remote.completed ||
        t.completedAt !== remote.completedAt ||
        t.name !== remote.name ||
        t.description !== remote.description ||
        t.priority !== remote.priority ||
        t.dueDate !== remote.dueDate ||
        JSON.stringify(t.subtasks) !== JSON.stringify(remote.subtasks) ||
        t.recurrence !== remote.recurrence
      );
    });
    if (needsUpdate) {
      const merged = localState.tasks.map((t: Task) => {
        const remote = remoteMap.get(t.id);
        if (!remote) return t;
        return { ...t, ...remote };
      });
      store.setState({ tasks: merged });
    }
  }
}

async function doInitialSync(
  setState: (s: Partial<SyncState>) => void,
  userId: string
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.warn('[TasksSync] doInitialSync error:', error.message);
    _hasSeeded = true;
    setState({ loading: false, error: `tasks: ${error.message}` });
    return;
  }

  if (data && data.length > 0) {
    const store = getStore();
    const localState = store.getState();
    const existingIds = new Set(localState.tasks.map((t: Task) => t.id));
    const newTasks: Task[] = (data as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .map((r) => {
        let subtasks: Subtask[] = [];
        try {
          if (r.subtasks && typeof r.subtasks === 'string') {
            subtasks = JSON.parse(r.subtasks as string);
          }
        } catch {}
        return {
          id: r.id as string,
          name: r.title as string ?? "",
          description: r.description as string ?? undefined,
          priority: (r.priority as string ?? "medium") as Task['priority'],
          dueDate: r.due_date as string ?? new Date().toISOString(),
          completed: (r.is_completed as boolean) ?? false,
          completedAt: (r.completed_at as string) ?? null,
          subtasks,
          recurrence: (r.recurrence as string ?? "none") as Task['recurrence'],
        };
      });
    if (newTasks.length > 0) {
      store.setState({ tasks: [...newTasks, ...localState.tasks] });
    }
  } else if (!_hasSeeded) {
    await seedTasks(userId);
  }

  _hasSeeded = true;
  setState({ loading: false, error: null, lastSyncAt: new Date() });
}

async function seedTasks(userId: string) {
  const store = getStore();
  const state = store.getState();
  const items = state.tasks as Task[];
  if (items.length === 0) return;
  const rows = items.map((t) => ({
    id: t.id,
    user_id: userId,
    title: t.name,
    description: t.description ?? null,
    priority: t.priority,
    due_date: t.dueDate,
    is_completed: t.completed,
    completed_at: t.completedAt,
    subtasks: JSON.stringify(t.subtasks),
    recurrence: t.recurrence,
  }));
  supabase.from("tasks").upsert(rows, { onConflict: "id" }).then(({ error }) => {
      if (error) console.warn('[TasksSync] seedTasks upsert error:', error.message);
    });
}

export async function syncTasksNow(userId: string): Promise<void> {
  _hasSeeded = true;
  await doPull(userId);
}

export async function queueTaskSync(entity: string, action: "create" | "delete", payload: Record<string, unknown>) {
  try {
    const { enqueue } = require("../../../services/syncQueue");
    await enqueue(entity, action, payload);
  } catch (e) {
    console.warn('[TasksSync] queueTaskSync failed:', e);
  }
}
