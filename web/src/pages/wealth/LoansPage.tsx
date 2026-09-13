import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, Lock, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useCreateFD,
  useCreateLoan,
  useDeleteFD,
  useDeleteLoan,
  useFDs,
  useLoans,
  useUpdateFD,
  useUpdateLoan,
} from '../../hooks/data/useInvestments'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { parseRupees, paiseToRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { FixedDeposit, Loan } from '../../types'

type Entry = Loan | FixedDeposit

export function LoansPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: loans, isLoading } = useLoans(userId)
  const { data: fds } = useFDs(userId)
  const deleteLoan = useDeleteLoan(userId)
  const deleteFD = useDeleteFD(userId)

  const [deleting, setDeleting] = useState<Entry | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [creating, setCreating] = useState<'loan' | 'fd' | null>(null)

  const totalLoans = (loans ?? []).reduce((s, l) => s + (l.amount || 0), 0)
  const totalFDs = (fds ?? []).reduce((s, f) => s + (f.amount || 0), 0)

  const doDelete = async () => {
    if (!deleting) return
    try {
      const isFD = (fds ?? []).some((f) => f.id === deleting.id)
      if (isFD) {
        await deleteFD.mutateAsync(deleting.id)
        toast.success('FD deleted')
      } else {
        await deleteLoan.mutateAsync(deleting.id)
        toast.success('Loan deleted')
      }
    } catch {
      toast.error('Failed to delete')
    }
    setDeleting(null)
  }

  const renderEntry = (entry: Entry, kind: 'loan' | 'fd') => {
    const isFD = kind === 'fd'
    const Icon = isFD ? Lock : Wallet
    const accent = isFD ? '#4FDBCC' : '#FF887D'
    return (
      <Card key={entry.id} className="group p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}1A` }}
            >
              <Icon className="h-4 w-4" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">{entry.name}</p>
              <p className="text-xs text-white/35">{isFD ? 'Deposit value' : 'Outstanding principal'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm font-semibold tnum" style={{ color: accent }}>
              {isFD ? '+' : '−'}
              {paiseToRupees(entry.amount)}
            </p>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing(entry)}
                className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDeleting(entry)}
                className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Loans & FDs"
        subtitle={
          (loans ?? []).length + (fds ?? []).length > 0
            ? `${loans?.length ?? 0} loan${(loans?.length ?? 0) > 1 ? 's' : ''} · ${paiseToRupees(totalLoans)} outstanding · ${fds?.length ?? 0} FD${(fds?.length ?? 0) > 1 ? 's' : ''} · ${paiseToRupees(totalFDs)}`
            : 'Track outstanding loans and fixed deposits against your wealth'
        }
        action={
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setCreating('loan')}>
              <Plus className="h-4 w-4" /> Add loan
            </Button>
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setCreating('fd')}>
              <Landmark className="h-4 w-4" /> Add FD
            </Button>
          </div>
        }
      />

      {/* Loans section */}
      <div className="flex items-center gap-2 pt-1">
        <Wallet className="h-4 w-4 text-[#FF887D]" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Loans</h2>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (loans ?? []).length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/35">
          No loans tracked.
        </p>
      ) : (
        <div className="space-y-3">{(loans ?? []).map((l) => renderEntry(l, 'loan'))}</div>
      )}

      {/* FDs section */}
      <div className="flex items-center gap-2 pt-3">
        <Lock className="h-4 w-4 text-[#4FDBCC]" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Fixed Deposits</h2>
      </div>
      {(fds ?? []).length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/35">
          No FDs tracked. FD amounts add to your net wealth.
        </p>
      ) : (
        <div className="space-y-3">{(fds ?? []).map((f) => renderEntry(f, 'fd'))}</div>
      )}

      <EntryModal
        open={!!creating || !!editing}
        kind={
          editing ? ((fds ?? []).some((f) => f.id === editing.id) ? 'fd' : 'loan') : (creating as 'loan' | 'fd')
        }
        entry={editing}
        onClose={() => {
          setCreating(null)
          setEditing(null)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete entry"
        message="This entry will be permanently removed."
        loading={deleteLoan.isPending || deleteFD.isPending}
      />
    </div>
  )
}

function EntryModal({
  open,
  kind,
  entry,
  onClose,
}: {
  open: boolean
  kind: 'loan' | 'fd'
  entry: Entry | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const createLoan = useCreateLoan(userId)
  const updateLoan = useUpdateLoan(userId)
  const createFD = useCreateFD(userId)
  const updateFD = useUpdateFD(userId)

  const isFD = kind === 'fd'
  const isEditing = !!entry

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(entry?.name ?? '')
    setAmount(entry ? String(entry.amount / 100) : '')
  }, [open, entry])

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(isFD ? 'FD name required' : 'Loan name required')
      return
    }
    const amt = rupeesToPaise(parseRupees(amount))
    if (amt <= 0) {
      toast.error(isFD ? 'Enter a valid deposit amount' : 'Enter a valid outstanding amount')
      return
    }
    setSaving(true)
    try {
      if (isFD) {
        const row: Partial<FixedDeposit> = { name: name.trim(), amount: amt }
        if (entry) {
          await updateFD.mutateAsync({ id: entry.id, row })
          toast.success('FD updated')
        } else {
          await createFD.mutateAsync({ row })
          toast.success('FD added')
        }
      } else {
        const row: Partial<Loan> = { name: name.trim(), amount: amt }
        if (entry) {
          await updateLoan.mutateAsync({ id: entry.id, row })
          toast.success('Loan updated')
        } else {
          await createLoan.mutateAsync({ row })
          toast.success('Loan added')
        }
      }
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isFD ? (isEditing ? 'Edit FD' : 'Add FD') : isEditing ? 'Edit loan' : 'Add loan'}>
      <div className="space-y-4">
        <Field.Input
          label={isFD ? 'FD name' : 'Loan name'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isFD ? 'e.g. HDFC FD' : 'e.g. Bike loan'}
          required
        />
        <Field.Input
          label={isFD ? 'Deposit amount (₹)' : 'Outstanding amount (₹)'}
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <p className="text-xs text-white/35">
          Net wealth on the{' '}
          <Link to="/wealth" className="text-[#9BA5FF] hover:underline">
            Wealth dashboard
          </Link>{' '}
          is calculated as Investments + FDs − Loans.
        </p>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={onSubmit} loading={saving}>
            {isEditing ? 'Save changes' : isFD ? 'Add FD' : 'Add loan'}
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
