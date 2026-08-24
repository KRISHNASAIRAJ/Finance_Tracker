import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCareerEvents, useUpsertCareerEvent, useDeleteCareerEvent } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton, StatCard } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate } from '../../lib/format'
import { fromInputDate, toInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { CareerEventType } from '../../types'

const TYPE_META: Record<CareerEventType, { label: string; color: string; icon: typeof ArrowUp }> = {
  up: { label: 'Up', color: '#59D6C7', icon: ArrowUp },
  down: { label: 'Down', color: '#FF887D', icon: ArrowDown },
  balance: { label: 'Balance', color: '#E2A45C', icon: Minus },
}

export function CareerTrackerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: events, isLoading } = useCareerEvents(userId)
  const del = useDeleteCareerEvent(userId)

  const [deleting, setDeleting] = useState<string | null>(null)

  const ups = (events ?? []).filter((e) => e.type === 'up').length
  const downs = (events ?? []).filter((e) => e.type === 'down').length
  const balance = ups - downs

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Event deleted') }
    catch { toast.error('Failed to delete event') }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Career Tracker"
        subtitle={`${events?.length ?? 0} events recorded`}
        action={
          <Link to="/career/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add event</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Ups" value={String(ups)} color="#59D6C7" />
        <StatCard label="Downs" value={String(downs)} color="#FF887D" />
        <StatCard label="Balance" value={String(balance)} color="#E2A45C" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (events ?? []).length === 0 ? (
        <EmptyState icon={Plus} title="No career events" subtitle="Record your first job milestone" action={<Link to="/career/new"><Button variant="secondary" size="sm">Add event</Button></Link>} />
      ) : (
        <div className="relative space-y-3 border-l border-white/10 pl-6">
          {(events ?? []).map((e) => {
            const meta = TYPE_META[e.type]
            return (
              <Card key={e.id} className="group relative p-5">
                <span
                  className="absolute -left-[31px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-2 border-black"
                  style={{ backgroundColor: meta.color }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{e.name}</p>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
                        <meta.icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">{formatDate(e.date)}</p>
                    {e.notes && <p className="mt-1.5 text-xs text-white/50">{e.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/career/${e.id}/edit`} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => setDeleting(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete event" message="This career event will be permanently removed." loading={del.isPending} />
    </div>
  )
}

export function CareerEventFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()

  const { data: events } = useCareerEvents(userId)
  const upsert = useUpsertCareerEvent(userId)

  const existing = id ? (events ?? []).find((e) => e.id === id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [date, setDate] = useState(existing ? toInputDate(existing.date) : toInputDate(new Date().toISOString()))
  const [type, setType] = useState<CareerEventType>(existing?.type ?? 'balance')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Event name required'); return }
    setSaving(true)
    try {
      await upsert.mutateAsync({
        row: { name: name.trim(), date: fromInputDate(date), type, notes: notes.trim() || null },
        id: existing?.id,
      })
      toast.success(existing ? 'Event updated' : 'Event added')
      navigate('/career')
    } catch { toast.error('Failed to save event') } finally { setSaving(false) }
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader title={existing ? 'Edit event' : 'Add event'} subtitle={existing ? 'Update this career event' : 'Record a career milestone'} />
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-4 p-5">
          <Field.Input label="Event name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Promoted to Senior Engineer" />
          <Field.Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field.Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as CareerEventType)}
            options={[
              { value: 'up', label: 'Up — promotion / raise' },
              { value: 'down', label: 'Down — demotion / setback' },
              { value: 'balance', label: 'Balance — lateral move' },
            ]}
          />
          <Field.Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/career')}>Cancel</Button>
            <Button type="submit" loading={saving}>{existing ? 'Save' : 'Add event'}</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}