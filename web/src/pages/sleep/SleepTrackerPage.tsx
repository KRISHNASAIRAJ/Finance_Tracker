import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Moon, Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSleepLogs, useUpsertSleepLog, useDeleteSleepLog } from '../../hooks/data/usePersonal'
import { useSleepInsight } from '../../hooks/useAI'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { TrendLine } from '../../components/charts/Charts'
import { toast } from '../../components/ui/Toast'
import type { SleepEntry } from '../../types'

function durationHours(e: Pick<SleepEntry, 'start_time' | 'end_time'>): number {
  return Math.max(0, (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 3_600_000)
}

function formatDuration(h: number): string {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  if (hh === 0) return `${mm}m`
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`
}

function toInputDateTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() - 8 * 3_600_000)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function fromInputDateTime(s: string): string | null {
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function SleepTrackerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: entries, isLoading } = useSleepLogs(userId)
  const upsert = useUpsertSleepLog(userId)
  const del = useDeleteSleepLog(userId)
  const insight = useSleepInsight()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [bed, setBed] = useState(() => toInputDateTime())
  const [wake, setWake] = useState(() => toInputDateTime())
  const [quality, setQuality] = useState('')
  const [interruptions, setInterruptions] = useState('0')
  const [notes, setNotes] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [insightText, setInsightText] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...(entries ?? [])].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
    [entries]
  )

  const last7 = sorted.slice(0, 7).reverse()
  const avg = last7.length > 0 ? last7.reduce((s, e) => s + durationHours(e), 0) / last7.length : null
  const latest = sorted[0] ?? null
  const best = last7.length > 0 ? Math.max(...last7.map(durationHours)) : null
  const worst = last7.length > 0 ? Math.min(...last7.map(durationHours)) : null

  const chartData = last7.map((e) => ({
    label: new Date(e.start_time).toLocaleDateString('en-IN', { weekday: 'short' }),
    value: Number(durationHours(e).toFixed(1)),
  }))

  const openNew = () => {
    setEditing(null)
    setBed(toInputDateTime())
    setWake(toInputDateTime(new Date().toISOString()))
    setQuality('')
    setInterruptions('0')
    setNotes('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const e = sorted.find((x) => x.id === id)
    if (!e) return
    setEditing(id)
    setBed(toInputDateTime(e.start_time))
    setWake(toInputDateTime(e.end_time))
    setQuality(e.quality ? String(e.quality) : '')
    setInterruptions(String(e.interruptions ?? 0))
    setNotes(e.notes ?? '')
    setModalOpen(true)
  }

  const save = async () => {
    const startIso = fromInputDateTime(bed)
    const endIso = fromInputDateTime(wake)
    if (!startIso || !endIso) { toast.error('Valid bed and wake times required'); return }
    if (new Date(endIso) <= new Date(startIso)) { toast.error('Wake time must be after bedtime'); return }
    const q = quality ? Number(quality) : null
    if (q !== null && (q < 1 || q > 5)) { toast.error('Quality must be 1–5'); return }
    setSaving(true)
    try {
      const row = {
        start_time: startIso,
        end_time: endIso,
        quality: q,
        interruptions: Math.max(0, Number(interruptions) || 0),
        notes: notes.trim() || null,
        source: 'manual' as const,
      }
      await upsert.mutateAsync({ row, id: editing ?? undefined })
      toast.success(editing ? 'Sleep updated' : 'Sleep logged')
      setModalOpen(false)
    } catch { toast.error('Failed to save sleep log') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Sleep log deleted') }
    catch { toast.error('Failed to delete sleep log') }
    setDeleting(null)
  }

  const getInsight = async () => {
    if (sorted.length === 0) return
    try {
      const nights = sorted
        .slice(0, 14)
        .reverse()
        .map((e) => ({
          startTime: e.start_time,
          endTime: e.end_time,
          durationHours: Number(durationHours(e).toFixed(1)),
          quality: e.quality ?? null,
          interruptions: e.interruptions ?? 0,
        }))
      const res = await insight.mutateAsync({ nights })
      setInsightText(res.insight ?? 'No insight available right now.')
    } catch {
      setInsightText('Could not reach the AI service. Try again later.')
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Sleep Tracker"
        subtitle={`${sorted.length} nights logged`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Log night
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Last night</p>
          <p className="mt-1 text-xl font-bold text-white tnum">{latest ? formatDuration(durationHours(latest)) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">7-night avg</p>
          <p className={`mt-1 text-xl font-bold tnum ${(avg ?? 0) >= 7 ? 'text-[#59D6C7]' : 'text-[#FF887D]'}`}>
            {avg !== null ? formatDuration(avg) : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Best (7n)</p>
          <p className="mt-1 text-xl font-bold text-[#59D6C7] tnum">{best !== null ? formatDuration(best) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-white/50">Shortest (7n)</p>
          <p className="mt-1 text-xl font-bold text-[#FF887D] tnum">{worst !== null ? formatDuration(worst) : '—'}</p>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardBody>
            <TrendLine data={chartData} color="#7B8EFF" height={180} formatter={(v) => formatDuration(v)} />
          </CardBody>
        </Card>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardBody className="space-y-3">
            {insightText ? (
              <p className="text-sm leading-relaxed text-white/80">{insightText}</p>
            ) : (
              <button
                onClick={getInsight}
                disabled={insight.isPending}
                className="flex items-center gap-2 rounded-lg text-sm font-medium text-[#7B8EFF] hover:text-white transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {insight.isPending ? 'Thinking…' : 'Get AI sleep insight'}
              </button>
            )}
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Moon} title="No sleep logs yet" subtitle="Log your first night to see trends" action={<Button variant="secondary" size="sm" onClick={openNew}>Log night</Button>} />
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="px-5 py-3 font-medium">Night</th>
                  <th className="px-5 py-3 font-medium">Bed → Wake</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Quality</th>
                  <th className="px-5 py-3 font-medium">Wakes</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const dur = durationHours(e)
                  return (
                    <tr key={e.id} className="border-b border-white/5 last:border-0 group">
                      <td className="px-5 py-3 text-white/80">
                        {new Date(e.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {e.source === 'auto' && <span className="ml-2 rounded bg-[#7B8EFF]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#7B8EFF]">auto</span>}
                      </td>
                      <td className="px-5 py-3 text-white/50">
                        {new Date(e.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} → {new Date(e.end_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className={`px-5 py-3 font-bold tnum ${dur < 6 ? 'text-[#FF887D]' : dur >= 7 ? 'text-[#59D6C7]' : 'text-white'}`}>
                        {formatDuration(dur)}
                      </td>
                      <td className="px-5 py-3 text-white/50">{e.quality ? `${e.quality}/5` : '—'}</td>
                      <td className="px-5 py-3 text-white/50">{e.interruptions ?? 0}</td>
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
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit sleep' : 'Log a night'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Bed time" type="datetime-local" value={bed} onChange={(e) => setBed(e.target.value)} />
          <Field.Input label="Wake time" type="datetime-local" value={wake} onChange={(e) => setWake(e.target.value)} />
          <div>
            <p className="mb-1.5 text-xs font-medium text-white/50">Quality (optional)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(quality === String(q) ? '' : String(q))}
                  className={`h-9 w-9 rounded-lg border text-sm font-bold transition-colors ${
                    quality === String(q)
                      ? 'border-[#7B8EFF] bg-[#7B8EFF]/20 text-white'
                      : 'border-white/10 text-white/40 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <Field.Input label="Night wakes" type="number" min="0" value={interruptions} onChange={(e) => setInterruptions(e.target.value)} />
          <Field.Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete sleep log" message="This night will be permanently removed." loading={del.isPending} />
    </div>
  )
}
