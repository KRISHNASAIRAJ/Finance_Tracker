/**
 * useTasks — tasks with subtasks, recurrence, priority.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Subtask, Task } from '../../types'
import { uid } from '../../lib/utils'

export const taskKeys = {
  all: (userId: string) => ['tasks', userId] as const,
}

export function useTasks(userId: string) {
  return useQuery({
    queryKey: taskKeys.all(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
      if (error) throw error
      const tasks = (data ?? []) as Task[]
      return tasks.map((t) => ({
        ...t,
        subtasks: parseSubtasks(t.subtasks),
      }))
    },
    enabled: !!userId,
  })
}

function parseSubtasks(raw: Subtask[] | string | null | undefined): Subtask[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getNextDueDate(currentDue: string, recurrence: string): string {
  const d = new Date(currentDue)
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekdays': {
      do {
        d.setDate(d.getDate() + 1)
      } while (d.getDay() === 0 || d.getDay() === 6)
      break
    }
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    default:
      return currentDue
  }
  return d.toISOString()
}

function useTaskMutations(userId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.all(userId) })

  const upsert = useMutation({
    mutationFn: async ({ row, id }: { row: Partial<Task>; id?: string }) => {
      const payload: Partial<Task> = { ...row, user_id: userId }
      if (id) payload.id = id
      const { data, error } = await supabase
        .from('tasks')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { upsert, remove }
}

export function useCreateTask(userId: string) {
  const { upsert } = useTaskMutations(userId)
  return useMutation({
    mutationFn: (input: {
      title: string
      description?: string
      priority: Task['priority']
      dueDate: string
      subtasks: string[]
      recurrence: string
    }) =>
      upsert.mutateAsync({
        row: {
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          due_date: input.dueDate,
          is_completed: false,
          completed_at: null,
          subtasks: JSON.stringify(
            input.subtasks.map((name) => ({ id: uid(), name, completed: false }))
          ) as unknown as Task['subtasks'],
          recurrence: input.recurrence as Task['recurrence'],
        },
      }),
  })
}

export function useUpdateTask(userId: string) {
  const { upsert } = useTaskMutations(userId)
  return useMutation({
    mutationFn: (input: {
      id: string
      title: string
      description?: string
      priority: Task['priority']
      dueDate: string
      subtasks: Subtask[]
      recurrence: string
    }) =>
      upsert.mutateAsync({
        id: input.id,
        row: {
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          due_date: input.dueDate,
          subtasks: JSON.stringify(input.subtasks) as unknown as Task['subtasks'],
          recurrence: input.recurrence as Task['recurrence'],
        },
      }),
  })
}

export function useDeleteTask(userId: string) {
  return useTaskMutations(userId).remove
}

/** Toggle completion; if recurring and newly completed, auto-creates next instance. */
export function useToggleTask(userId: string) {
  const qc = useQueryClient()
  const { upsert } = useTaskMutations(userId)

  return useMutation({
    mutationFn: async (task: Task) => {
      const newCompleted = !task.is_completed
      const now = new Date().toISOString()

      // Update current task — must be UPDATE not upsert (partial fields
      // would violate NOT NULL title on the INSERT branch)
      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: newCompleted, completed_at: newCompleted ? now : null })
        .eq('id', task.id)
      if (error) throw error

      // create next recurring instance
      if (newCompleted && task.recurrence && task.recurrence !== 'none') {
        const nextDate = getNextDueDate(task.due_date ?? now, task.recurrence)
        const resetSubtasks = (task.subtasks ?? []).map((s) => ({ ...s, completed: false }))
        await upsert.mutateAsync({
          row: {
            title: task.title,
            description: task.description ?? null,
            priority: task.priority,
            due_date: nextDate,
            is_completed: false,
            completed_at: null,
            subtasks: JSON.stringify(resetSubtasks) as unknown as Task['subtasks'],
            recurrence: task.recurrence as Task['recurrence'],
          },
        })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(userId) }),
  })
}

export function useToggleSubtask(userId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ task, subtaskId }: { task: Task; subtaskId: string }) => {
      const subtasks = (task.subtasks ?? []).map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      )
      // UPDATE only subtasks column (upsert would need NOT NULL title)
      const { error } = await supabase
        .from('tasks')
        .update({ subtasks: JSON.stringify(subtasks) })
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(userId) }),
  })
}

/** Purge completed tasks older than 7 days. */
export function usePurgeOldTasks(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (completedTasks: Task[]) => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      const ids = completedTasks
        .filter((t) => {
          const at = t.completed_at ? new Date(t.completed_at).getTime() : 0
          return at < cutoff
        })
        .map((t) => t.id)
      if (ids.length === 0) return
      const { error } = await supabase.from('tasks').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(userId) }),
  })
}