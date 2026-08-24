import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useReceivables,
  useCreateReceivable,
  useUpdateReceivable,
  useDeleteReceivable,
  useMarkReceivablePaid,
} from '../../hooks/data/useReceivables'
import { PageHeader, EmptyState, Skeleton, Badge } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate, paiseToRupees, parseRupees, rupeesToPaise } from '../../lib/format'
import { toInputDate, fromInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { Receivable } from '../../types'

type Tab = 'all' | 'lent' | 'borrowed'

const STATUS_COLORS: Record<string, string> = {
  paid: '#59D6C7',
  partial: '#E2A45C',
  pending: '#FF887D',
}

export function LentBorrowedPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: items, isLoading } = useReceivables(userId)
  const createRecv = useCreateReceivable(userId)
  const updateRecv = useUpdateReceivable(userId)
  const deleteRecv = useDeleteReceivable(userId)
  const markPaid = useMarkReceivablePaid(userId)

  const [tab, setTab] = useState<Tab>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [personName, setPersonName] = useState('')
  const [amount, setAmount] = useState('')
  const [recvType, setRecvType] = useState<'lent' | 'borrowed'>('lent')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = items?.filter((r) => tab === 'all' || r.type === tab) ?? []

  const openNew = () => {
    setEditing(null)
    setPersonName('')
    setAmount('')
    setRecvType('lent')
    setDueDate('')
    setNote('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const r = (items ?? []).find((x) => x.id === id)
    if (!r) return
    setEditing(id)
    setPersonName(r.person_name)
    setAmount(String(r.amount / 100))
    setRecvType(r.type)
    setDueDate(toInputDate(r.due_date))
    setNote(r.note ?? '')
    setModalOpen(true)
  }

  const save = async () => {
    if (!personName.trim()) {
      toast.error('Person name required')
      return
    }
    const paise = rupeesToPaise(parseRupees(amount))
    if (!paise || paise <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const row: Partial<Receivable> = {
        person_name: personName.trim(),
        amount: paise,
        type: recvType,
        due_date: fromInputDate(dueDate),
        note: note.trim() || null,
      }
      if (editing) {
        await updateRecv.mutateAsync({ id: editing, row })
        toast.success('Record updated')
      } else {
        await createRecv.mutateAsync({ row })
        toast.success('Record added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteRecv.mutateAsync(deleting)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setDeleting(null)
  }

  const handleMarkPaid = async (id: string) => {
    const r = (items ?? []).find((x) => x.id === id)
    if (!r) return
    try {
      await markPaid.mutateAsync({ id, paidAmount: r.amount })
      toast.success('Marked as paid')
    } catch {
      toast.error('Failed to mark paid')
    }
  }

  const totalOutstanding = (items ?? []).reduce((s, r) => {
    if ((r.paid_amount ?? 0) >= r.amount) return s
    return s + (r.amount - (r.paid_amount ?? 0))
  }, 0)

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Lent / Borrowed"
        subtitle={`${paiseToRupees(totalOutstanding)} outstanding across ${items?.length ?? 0} records`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />

      <div className="flex gap-1 rounded-xl border border-white/10 p-1 w-fit">
        {(['all', 'lent', 'borrowed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t === 'all' ? 'All' : t === 'lent' ? 'Lent' : 'Borrowed'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Plus} title="No records" subtitle="Add your first lent or borrowed record" action={<Button variant="secondary" size="sm" onClick={openNew}>Add record</Button>} />
      ) : (
        <Card>
          <div className="divide-y divide-white/5">
            {filtered.map((r) => {
              const isPaid = (r.paid_amount ?? 0) >= r.amount
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/90">{r.person_name}</p>
                      <Badge color={r.type === 'lent' ? '#9BA5FF' : '#E2A45C'}>
                        {r.type === 'lent' ? 'Lent' : 'Borrowed'}
                      </Badge>
                      <Badge color={STATUS_COLORS[r.status ?? 'pending']}>
                        {r.status === 'paid' ? 'Paid' : r.status === 'partial' ? 'Partial' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">
                      Due {formatDate(r.due_date)}{r.note ? ` · ${r.note}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tnum text-white">
                    {paiseToRupees(r.amount - (r.paid_amount ?? 0))}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isPaid && (
                      <button onClick={() => handleMarkPaid(r.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#59D6C7]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => openEdit(r.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(r.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit record' : 'Add record'}
        subtitle={editing ? 'Update the record details' : 'Create a new lent or borrowed record'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Person name" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="e.g. Rahul" />
          <Field.Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          <Field.Select
            label="Type"
            value={recvType}
            onChange={(e) => setRecvType(e.target.value as 'lent' | 'borrowed')}
            options={[
              { value: 'lent', label: 'Lent (I gave money)' },
              { value: 'borrowed', label: 'Borrowed (I took money)' },
            ]}
          />
          <Field.Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Field.Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any notes..." />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete record" message="This record will be permanently removed." loading={deleteRecv.isPending} />
    </div>
  )
}