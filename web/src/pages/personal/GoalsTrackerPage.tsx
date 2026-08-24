import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, Target } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGoals2026, useUpsertGoal2026, useDeleteGoal2026 } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'

export function GoalsTrackerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: goals, isLoading } = useGoals2026(userId)
  const upsert = useUpsertGoal2026(userId)
  const del = useDeleteGoal2026(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const completed = (goals ?? []).filter((g) => g.is_completed).length
  const total = goals?.length ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const addGoal = async () => {
    if (!title.trim()) { toast.error('Goal title required'); return }
    setSaving(true)
    try {
      await upsert.mutateAsync({ row: { title: title.trim(), is_completed: false } })
      toast.success('Goal added')
      setTitle('')
      setModalOpen(false)
    } catch { toast.error('Failed to add goal') } finally { setSaving(false) }
  }

  const toggle = async (id: string, isCompleted: boolean) => {
    try {
      await upsert.mutateAsync({ id, row: { is_completed: !isCompleted } })
    } catch { toast.error('Failed to update goal') }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Goal deleted') }
    catch { toast.error('Failed to delete goal') }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Goals 2026"
        subtitle={`${completed}/${total} completed`}
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add goal
          </Button>
        }
      />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-xs font-medium text-white/50">Progress</p>
              <p className="text-xs font-semibold text-white tnum">{pct}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#59D6C7] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white tnum">{completed}<span className="text-white/30">/{total}</span></p>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (goals ?? []).length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" subtitle="Add your 2026 goals to start tracking" action={<Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>Add goal</Button>} />
      ) : (
        <div className="space-y-3">
          {(goals ?? []).map((g) => (
            <Card key={g.id} className="group flex items-center gap-3 p-4">
              <button onClick={() => toggle(g.id, g.is_completed)} className="shrink-0 text-white/40 transition-colors hover:text-[#59D6C7]">
                {g.is_completed ? <CheckCircle2 className="h-5 w-5 text-[#59D6C7]" /> : <Circle className="h-5 w-5" />}
              </button>
              <p className={`flex-1 text-sm ${g.is_completed ? 'text-white/35 line-through' : 'text-white/85'}`}>{g.title}</p>
              <button onClick={() => setDeleting(g.id)} className="shrink-0 rounded-lg p-1.5 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-[#FF887D]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add goal"
        subtitle="A goal for 2026"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={addGoal} loading={saving}>Add</Button>
          </>
        }
      >
        <Field.Input label="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read 24 books" />
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete goal" message="This goal will be permanently removed." loading={del.isPending} />
    </div>
  )
}