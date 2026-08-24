import { useState } from 'react'
import { Plus, Pencil, Trash2, Weight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useWeightLogs, useUpsertWeight, useDeleteWeight } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { TrendLine } from '../../components/charts/Charts'
import { formatDate, formatNumber } from '../../lib/format'
import { toInputDate, fromInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { WeightEntry } from '../../types'

export function WeightTrackerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: entries, isLoading } = useWeightLogs(userId)
  const upsert = useUpsertWeight(userId)
  const del = useDeleteWeight(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [date, setDate] = useState(() => toInputDate(new Date().toISOString()))
  const [weightKg, setWeightKg] = useState('')
  const [notes, setNotes] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sorted = entries ?? []
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null
  const first = sorted.length > 0 ? sorted[0] : null
  const changeSinceFirst = latest && first ? latest.weight_kg - first.weight_kg : 0
  const minEntry = sorted.length > 0 ? sorted.reduce((a, b) => (a.weight_kg < b.weight_kg ? a : b)) : null
  const maxEntry = sorted.length > 0 ? sorted.reduce((a, b) => (a.weight_kg > b.weight_kg ? a : b)) : null

  const chartData = sorted.map((e) => ({
    label: formatDate(e.date),
    value: e.weight_kg,
  }))

  const openNew = () => {
    setEditing(null)
    setDate(toInputDate(new Date().toISOString()))
    setWeightKg('')
    setNotes('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const e = sorted.find((x) => x.id === id)
    if (!e) return
    setEditing(id)
    setDate(toInputDate(e.date))
    setWeightKg(String(e.weight_kg))
    setNotes(e.notes ?? '')
    setModalOpen(true)
  }

  const save = async () => {
    if (!weightKg || Number(weightKg) <= 0) { toast.error('Valid weight required'); return }
    setSaving(true)
    try {
      const row: Partial<WeightEntry> = { date: fromInputDate(date), weight_kg: Number(weightKg), notes: notes.trim() || null }
      await upsert.mutateAsync({ row, id: editing ?? undefined })
      toast.success(editing ? 'Weight updated' : 'Weight added')
      setModalOpen(false)
    } catch { toast.error('Failed to save weight') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Weight deleted') }
    catch { toast.error('Failed to delete weight') }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Weight Tracker"
        subtitle={`${sorted.length} entries`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Latest</p>
          <p className="mt-1 text-xl font-bold text-white tnum">{latest ? formatNumber(latest.weight_kg) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Change</p>
          <p className={`mt-1 text-xl font-bold tnum ${changeSinceFirst > 0 ? 'text-[#FF887D]' : changeSinceFirst < 0 ? 'text-[#59D6C7]' : 'text-white'}`}>
            {latest ? `${changeSinceFirst > 0 ? '+' : ''}${formatNumber(changeSinceFirst)}` : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Min</p>
          <p className="mt-1 text-xl font-bold text-[#59D6C7] tnum">{minEntry ? formatNumber(minEntry.weight_kg) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Max</p>
          <p className="mt-1 text-xl font-bold text-[#FF887D] tnum">{maxEntry ? formatNumber(maxEntry.weight_kg) : '—'}</p>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardBody>
            <TrendLine data={chartData} color="#59D6C7" height={180} formatter={(v) => `${v} kg`} />
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Weight} title="No weight entries" subtitle="Start tracking your weight" action={<Button variant="secondary" size="sm" onClick={openNew}>Add entry</Button>} />
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Weight (kg)</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((e) => (
                  <tr key={e.id} className="border-b border-white/5 last:border-0 group">
                    <td className="px-5 py-3 text-white/80">{formatDate(e.date)}</td>
                    <td className="px-5 py-3 font-bold text-white tnum">{formatNumber(e.weight_kg)}</td>
                    <td className="px-5 py-3 text-white/50">{e.notes ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleting(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit weight' : 'Add weight entry'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field.Input label="Weight (kg)" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="0.0" />
          <Field.Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete weight entry" message="This entry will be permanently removed." loading={del.isPending} />
    </div>
  )
}