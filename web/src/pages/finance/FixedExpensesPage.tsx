import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useFixedExpenses,
  useCreateFixedExpense,
  useUpdateFixedExpense,
  useDeleteFixedExpense,
} from '../../hooks/data/useFixedExpenses'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { EXPENSE_CATEGORIES, getCategoryIcon } from '../../lib/categoryMap'
import { paiseToRupees, parseRupees, rupeesToPaise } from '../../lib/format'
import { istMonthKey, toInputDate, fromInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { FixedExpense } from '../../types'

export function FixedExpensesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: items, isLoading } = useFixedExpenses(userId)
  const createExp = useCreateFixedExpense(userId)
  const updateExp = useUpdateFixedExpense(userId)
  const deleteExp = useDeleteFixedExpense(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [billingDay, setBillingDay] = useState('1')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].name)
  const [dueDate, setDueDate] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setName('')
    setAmount('')
    setBillingDay('1')
    setCategory(EXPENSE_CATEGORIES[0].name)
    setDueDate('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const e = (items ?? []).find((x) => x.id === id)
    if (!e) return
    setEditing(id)
    setName(e.name)
    setAmount(String(e.amount / 100))
    setBillingDay(String(e.billing_day))
    setCategory(e.category)
    setDueDate(toInputDate(e.due_date))
    setModalOpen(true)
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name required')
      return
    }
    const paise = rupeesToPaise(parseRupees(amount))
    if (!paise || paise <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const day = Number(billingDay)
    if (!day || day < 1 || day > 31) {
      toast.error('Billing day must be 1–31')
      return
    }
    setSaving(true)
    try {
      const row: Partial<FixedExpense> = {
        name: name.trim(),
        amount: paise,
        billing_day: day,
        category,
        due_date: fromInputDate(dueDate),
      }
      if (editing) {
        await updateExp.mutateAsync({ id: editing, row })
        toast.success('Expense updated')
      } else {
        await createExp.mutateAsync({ row })
        toast.success('Expense added')
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
      await deleteExp.mutateAsync(deleting)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setDeleting(null)
  }

  const handleMarkPaid = async (id: string) => {
    const e = (items ?? []).find((x) => x.id === id)
    if (!e) return
    try {
      await updateExp.mutateAsync({ id, row: { last_paid_month: istMonthKey() } })
      toast.success('Marked as paid')
    } catch {
      toast.error('Failed to mark paid')
    }
  }

  const currentMonth = istMonthKey()
  const monthlyTotal = (items ?? []).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Fixed expenses"
        subtitle={`${paiseToRupees(monthlyTotal)} monthly across ${items?.length ?? 0} expenses`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (items ?? []).length === 0 ? (
        <EmptyState icon={Plus} title="No fixed expenses" subtitle="Add rent, subscriptions, EMIs and other recurring bills" action={<Button variant="secondary" size="sm" onClick={openNew}>Add expense</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(items ?? []).map((e) => {
            const Icon = getCategoryIcon(e.category)
            const paid = e.last_paid_month === currentMonth
            return (
              <Card key={e.id} className="p-5 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0 text-white/30" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90">{e.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {e.category} · Day {e.billing_day}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!paid && (
                      <button onClick={() => handleMarkPaid(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#59D6C7]" title="Mark paid">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => openEdit(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(e.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-xl font-bold text-white tnum">{paiseToRupees(e.amount)}</p>
                  <p className="text-[11px] text-white/40">
                    {paid ? (
                      <span className="flex items-center gap-1 text-[#59D6C7]">
                        <CheckCircle2 className="h-3 w-3" /> Paid this month
                      </span>
                    ) : (
                      `Last paid ${e.last_paid_month ? e.last_paid_month : 'never'}`
                    )}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit expense' : 'Add expense'}
        subtitle={editing ? 'Update the fixed expense' : 'Add a recurring bill or subscription'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix" />
          <Field.Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          <Field.Input label="Billing day (1–31)" type="number" min={1} max={31} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
          <Field.Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
          />
          <Field.Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete expense" message="This fixed expense will be permanently removed." loading={deleteExp.isPending} />
    </div>
  )
}