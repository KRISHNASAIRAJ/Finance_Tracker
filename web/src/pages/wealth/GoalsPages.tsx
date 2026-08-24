import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Target, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useInvestmentGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from '../../hooks/data/useInvestments'
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate, paiseToRupeesCompact, parseRupees, rupeesToPaise } from '../../lib/format'
import { fromInputDate, toInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { InvestmentGoal } from '../../types'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#59D6C7',
  medium: '#E2A45C',
  high: '#FF887D',
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function GoalsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: goals, isLoading } = useInvestmentGoals(userId)
  const deleteGoal = useDeleteGoal(userId)

  const [deleting, setDeleting] = useState<string | null>(null)

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteGoal.mutateAsync(deleting)
      toast.success('Goal deleted')
    } catch {
      toast.error('Failed to delete goal')
    }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Investment goals"
        subtitle={`${goals?.length ?? 0} goals`}
        action={
          <Link to="/wealth/goals/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add goal
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (goals ?? []).length === 0 ? (
        <EmptyState
          icon={Target}
          title="No investment goals"
          subtitle="Set a target amount and track progress"
          action={
            <Link to="/wealth/goals/new">
              <Button variant="secondary" size="sm">Add goal</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {(goals ?? []).map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, (g.current_progress / g.target_amount) * 100) : 0
            const achieved = g.current_progress >= g.target_amount
            return (
              <Card key={g.id} className="group p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white/85">{g.goal_name}</p>
                      {g.priority && <Badge color={PRIORITY_COLORS[g.priority]}>{g.priority}</Badge>}
                      {achieved && <Badge color="#59D6C7">Achieved</Badge>}
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${achieved ? 'bg-[#59D6C7]' : 'bg-[#9BA5FF]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-white/35">
                      {paiseToRupeesCompact(g.current_progress)} of {paiseToRupeesCompact(g.target_amount)}
                      {g.target_date && ` · by ${formatDate(g.target_date)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-white tnum">{pct.toFixed(0)}%</p>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        to={`/wealth/goals/${g.id}/edit`}
                        className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => setDeleting(g.id)}
                        className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete goal"
        message="This investment goal will be permanently removed."
        loading={deleteGoal.isPending}
      />
    </div>
  )
}

export function GoalFormPage() {
  const { id } = useParams()
  return <GoalForm id={id} />
}

function GoalForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: goals, isLoading } = useInvestmentGoals(userId)
  const createGoal = useCreateGoal(userId)
  const updateGoal = useUpdateGoal(userId)

  const existing = id ? (goals ?? []).find((g) => g.id === id) : undefined

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentProgress, setCurrentProgress] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setName(existing.goal_name)
    setTargetAmount(String(existing.target_amount / 100))
    setCurrentProgress(String(existing.current_progress / 100))
    setTargetDate(existing.target_date ? toInputDate(existing.target_date) : '')
    setPriority(existing.priority ?? 'medium')
    setNotes(existing.notes ?? '')
  }, [id, existing])

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error('Goal name required')
      return
    }
    const target = rupeesToPaise(parseRupees(targetAmount))
    if (target <= 0) {
      toast.error('Enter a valid target amount')
      return
    }
    setSaving(true)
    const row: Partial<InvestmentGoal> = {
      goal_name: name.trim(),
      target_amount: target,
      current_progress: rupeesToPaise(parseRupees(currentProgress)),
      target_date: targetDate ? fromInputDate(targetDate) : null,
      priority,
      notes: notes.trim() || null,
    }
    try {
      if (existing) {
        await updateGoal.mutateAsync({ id: existing.id, row })
        toast.success('Goal updated')
      } else {
        await createGoal.mutateAsync({ row })
        toast.success('Goal added')
      }
      navigate('/wealth/goals')
    } catch {
      toast.error('Failed to save goal')
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
        title={existing ? 'Edit goal' : 'New goal'}
        subtitle={existing ? 'Update this investment goal' : 'Define a new investment target'}
      />

      <div className="space-y-5">
        <Field.Input
          label="Goal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Down payment for car"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field.Input
            label="Target amount (₹)"
            type="number"
            step="0.01"
            min="0"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <Field.Input
            label="Current progress (₹)"
            type="number"
            step="0.01"
            min="0"
            value={currentProgress}
            onChange={(e) => setCurrentProgress(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field.Input
            label="Target date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <Field.Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <Field.Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why this goal matters"
        />

        <div className="flex gap-3">
          <Button className="flex-1" onClick={onSubmit} loading={saving}>
            {existing ? 'Save changes' : 'Add goal'}
          </Button>
          <Link to="/wealth/goals" className="flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
