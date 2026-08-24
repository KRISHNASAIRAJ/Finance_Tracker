import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
  useToggleSubtask,
} from '../../hooks/data/useTasks'
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDateTime } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import { uid } from '../../lib/utils'
import type { Subtask, Task } from '../../types'

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  urgent: '#FF887D',
  high: '#FF887D',
  medium: '#E2A45C',
  low: '#59D6C7',
}

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}

export function TaskDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: tasks, isLoading } = useTasks(userId)
  const toggleTask = useToggleTask(userId)
  const toggleSubtask = useToggleSubtask(userId)
  const deleteTask = useDeleteTask(userId)
  const [confirming, setConfirming] = useState(false)

  const task = (tasks ?? []).find((t) => t.id === id)

  const handleToggle = () => {
    if (!task) return
    toggleTask.mutate(task, { onError: () => toast.error('Failed to update task') })
  }

  const handleToggleSubtask = (subtaskId: string) => {
    if (!task) return
    toggleSubtask.mutate(
      { task, subtaskId },
      { onError: () => toast.error('Failed to update subtask') }
    )
  }

  const doDelete = async () => {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Task deleted')
      navigate('/tasks')
    } catch {
      toast.error('Failed to delete task')
    }
  }

  if (isLoading) {
    return (
      <div className="fade-up space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="fade-up space-y-5">
        <PageHeader title="Task" />
        <EmptyState icon={Trash2} title="Task not found" subtitle="It may have been deleted" />
      </div>
    )
  }

  const subtasks = task.subtasks ?? []
  const doneCount = subtasks.filter((s) => s.completed).length

  return (
    <div className="fade-up space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/tasks"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={task.title}
          subtitle={task.is_completed ? 'Completed' : 'Pending'}
          action={
            <Link to={`/tasks/${task.id}/edit`}>
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          }
        />
      </div>

      <Card>
        <CardBody className="space-y-5">
          {task.description ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/40">Description</p>
              <p className="whitespace-pre-wrap text-sm text-white/70">{task.description}</p>
            </div>
          ) : (
            <p className="text-sm text-white/30">No description</p>
          )}

          <div className="flex flex-wrap gap-2">
            {task.due_date && <Badge color="#9BA5FF">Due {formatDateTime(task.due_date)}</Badge>}
            <Badge color={PRIORITY_COLORS[task.priority]}>{task.priority} priority</Badge>
            <Badge>{task.recurrence && task.recurrence !== 'none' ? `Recurs ${task.recurrence}` : 'One-time'}</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Subtasks"
          subtitle={`${doneCount} of ${subtasks.length} done`}
        />
        <CardBody>
          {subtasks.length === 0 ? (
            <p className="py-2 text-center text-sm text-white/30">No subtasks</p>
          ) : (
            <div className="space-y-1">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                  <button
                    onClick={() => handleToggleSubtask(s.id)}
                    aria-label={s.completed ? 'Mark incomplete' : 'Mark complete'}
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      s.completed
                        ? 'border-[#59D6C7] bg-[#59D6C7]/20 text-[#59D6C7]'
                        : 'border-white/25 text-transparent hover:border-white/50'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <p className={`text-sm ${s.completed ? 'text-white/35 line-through' : 'text-white/75'}`}>
                    {s.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleToggle} loading={toggleTask.isPending} className="flex-1">
          {task.is_completed ? 'Mark as pending' : 'Mark as complete'}
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)} className="gap-1.5">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={doDelete}
        title="Delete task"
        message="This task and its subtasks will be permanently removed."
        loading={deleteTask.isPending}
      />
    </div>
  )
}

export function TaskFormPage() {
  const { id } = useParams()
  return <TaskForm id={id} />
}

function TaskForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: tasks, isLoading } = useTasks(userId)
  const createTask = useCreateTask(userId)
  const updateTask = useUpdateTask(userId)

  const existing = id ? (tasks ?? []).find((t) => t.id === id) : undefined

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [dueDate, setDueDate] = useState(toDatetimeLocal(new Date().toISOString()))
  const [recurrence, setRecurrence] = useState('none')
  const [subtaskNames, setSubtaskNames] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setTitle(existing.title)
    setDescription(existing.description ?? '')
    setPriority(existing.priority)
    setDueDate(existing.due_date ? toDatetimeLocal(existing.due_date) : toDatetimeLocal(new Date().toISOString()))
    setRecurrence(existing.recurrence ?? 'none')
    setSubtaskNames((existing.subtasks ?? []).map((s) => s.name))
  }, [id, existing])

  const updateSubtask = (index: number, value: string) => {
    setSubtaskNames((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  const removeSubtask = (index: number) => {
    setSubtaskNames((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async () => {
    if (!title.trim()) {
      toast.error('Task title required')
      return
    }
    if (!dueDate) {
      toast.error('Due date & time required')
      return
    }
    setSaving(true)
    try {
      if (existing) {
        const prev = existing.subtasks ?? []
        const subtasks: Subtask[] = subtaskNames
          .map((name, i) => {
            const trimmed = name.trim()
            if (!trimmed) return null
            const prevSub = prev[i]
            return prevSub
              ? { id: prevSub.id, name: trimmed, completed: prevSub.completed }
              : { id: uid(), name: trimmed, completed: false }
          })
          .filter((s): s is Subtask => s !== null)
        await updateTask.mutateAsync({
          id: existing.id,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: fromDatetimeLocal(dueDate),
          subtasks,
          recurrence,
        })
        toast.success('Task updated')
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: fromDatetimeLocal(dueDate),
          subtasks: subtaskNames.map((n) => n.trim()).filter(Boolean),
          recurrence,
        })
        toast.success('Task added')
      }
      navigate('/tasks')
    } catch {
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading && id) {
    return (
      <div className="fade-up space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader
        title={existing ? 'Edit task' : 'New task'}
        subtitle={existing ? 'Update this task' : 'Create a new task'}
      />

      <div className="space-y-5">
        <Field.Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Pay credit card bill"
          required
        />

        <Field.Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details worth remembering"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field.Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            options={PRIORITIES}
          />
          <Field.Select
            label="Recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            options={RECURRENCE_OPTIONS}
          />
        </div>

        <Field.Input
          label="Due date & time"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />

        <div className="space-y-2">
          <p className="block text-xs font-medium text-white/60">Subtasks</p>
          {subtaskNames.length === 0 && (
            <p className="text-xs text-white/30">No subtasks yet</p>
          )}
          {subtaskNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <Field.Input
                className="flex-1"
                value={name}
                onChange={(e) => updateSubtask(i, e.target.value)}
                placeholder={`Subtask ${i + 1}`}
              />
              <button
                onClick={() => removeSubtask(i)}
                className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/10 hover:text-[#FF887D]"
                aria-label="Remove subtask"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => setSubtaskNames([...subtaskNames, ''])}
          >
            <Plus className="h-3.5 w-3.5" /> Add subtask
          </Button>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={onSubmit} loading={saving}>
            {existing ? 'Save changes' : 'Add task'}
          </Button>
          <Link to="/tasks" className="flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
