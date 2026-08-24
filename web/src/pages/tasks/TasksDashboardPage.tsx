import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, CheckSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useTasks,
  useDeleteTask,
  useToggleTask,
  usePurgeOldTasks,
} from '../../hooks/data/useTasks'
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { formatDateTime } from '../../lib/format'
import { istDateString } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { Task } from '../../types'

const TABS = ['Today', 'Upcoming', 'Completed', 'All'] as const
type Tab = (typeof TABS)[number]

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  urgent: '#FF887D',
  high: '#FF887D',
  medium: '#E2A45C',
  low: '#59D6C7',
}

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function dueKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function TasksDashboardPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: tasks, isLoading } = useTasks(userId)
  const toggleTask = useToggleTask(userId)
  const deleteTask = useDeleteTask(userId)
  const purgeOld = usePurgeOldTasks(userId)

  const [tab, setTab] = useState<Tab>('Today')
  const [deleting, setDeleting] = useState<string | null>(null)

  const todayKey = istDateString()

  const visible = useMemo(() => {
    const all = tasks ?? []
    let list: Task[]
    switch (tab) {
      case 'Today':
        list = all.filter((t) => !t.is_completed && t.due_date && dueKey(t.due_date) === todayKey)
        list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        break
      case 'Upcoming':
        list = all.filter((t) => !t.is_completed && t.due_date && dueKey(t.due_date) > todayKey)
        list.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
        break
      case 'Completed':
        list = all.filter((t) => t.is_completed)
        list.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
        break
      default:
        list = [...all].sort((a, b) => {
          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
          return (a.due_date ?? '').localeCompare(b.due_date ?? '')
        })
    }
    return list
  }, [tasks, tab, todayKey])

  const completedCount = (tasks ?? []).filter((t) => t.is_completed).length

  const handleToggle = (t: Task) => {
    toggleTask.mutate(t, {
      onError: () => toast.error('Failed to update task'),
    })
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteTask.mutateAsync(deleting)
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    }
    setDeleting(null)
  }

  const clearCompleted = async () => {
    try {
      await purgeOld.mutateAsync((tasks ?? []).filter((t) => t.is_completed))
      toast.success('Cleared old completed tasks')
    } catch {
      toast.error('Failed to clear completed tasks')
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Tasks"
        subtitle={`${completedCount} completed · ${(tasks ?? []).length} total`}
        action={
          <Link to="/tasks/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompleted}
            disabled={purgeOld.isPending}
            className="text-xs text-white/40 transition-colors hover:text-[#FF887D] disabled:opacity-50"
          >
            Clear completed
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks"
          subtitle={`Nothing in ${tab.toLowerCase()}. Add a task to get started`}
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/tasks/new')}>
              Add task
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {visible.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0">
              <button
                onClick={() => handleToggle(t)}
                aria-label={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  t.is_completed
                    ? 'border-[#59D6C7] bg-[#59D6C7]/20 text-[#59D6C7]'
                    : 'border-white/25 text-transparent hover:border-white/50'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigate(`/tasks/${t.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className={`truncate text-sm font-medium ${t.is_completed ? 'text-white/35 line-through' : 'text-white/80'}`}>
                  {t.title}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {t.due_date && (
                    <span className="text-xs text-white/35">{formatDateTime(t.due_date)}</span>
                  )}
                  <Badge color={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                  {t.recurrence && t.recurrence !== 'none' && (
                    <Badge color="#9BA5FF">{t.recurrence}</Badge>
                  )}
                </div>
              </button>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => navigate(`/tasks/${t.id}/edit`)}
                  className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleting(t.id)}
                  className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete task"
        message="This task and its subtasks will be permanently removed."
        loading={deleteTask.isPending}
      />
    </div>
  )
}
