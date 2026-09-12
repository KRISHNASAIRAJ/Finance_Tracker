import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCreateLoan, useDeleteLoan, useLoans, useUpdateLoan } from '../../hooks/data/useInvestments'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { parseRupees, paiseToRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { Loan } from '../../types'

export function LoansPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: loans, isLoading } = useLoans(userId)
  const deleteLoan = useDeleteLoan(userId)

  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<Loan | null>(null)
  const [creating, setCreating] = useState(false)

  const totalLoans = (loans ?? []).reduce((s, l) => s + (l.amount || 0), 0)

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteLoan.mutateAsync(deleting)
      toast.success('Loan deleted')
    } catch {
      toast.error('Failed to delete loan')
    }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Loans"
        subtitle={
          (loans ?? []).length > 0
            ? `${loans?.length} loan${(loans ?? []).length > 1 ? 's' : ''} · ${paiseToRupees(totalLoans)} outstanding`
            : 'Track outstanding loans against your wealth'
        }
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add loan
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (loans ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No loans tracked"
          subtitle="Add a loan to see your true net wealth (Investments − Loans)"
          action={
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              Add loan
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(loans ?? []).map((l) => (
            <Card key={l.id} className="group p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF887D]/10">
                    <Wallet className="h-4 w-4 text-[#FF887D]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/85">{l.name}</p>
                    <p className="text-xs text-white/35">Outstanding principal</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-sm font-semibold text-[#FF887D] tnum">−{paiseToRupees(l.amount)}</p>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(l)}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleting(l.id)}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LoanModal
        open={creating || !!editing}
        loan={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete loan"
        message="This loan will be permanently removed."
        loading={deleteLoan.isPending}
      />
    </div>
  )
}

function LoanModal({
  open,
  loan,
  onClose,
}: {
  open: boolean
  loan: Loan | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const createLoan = useCreateLoan(userId)
  const updateLoan = useUpdateLoan(userId)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(loan?.name ?? '')
    setAmount(loan ? String(loan.amount / 100) : '')
  }, [open, loan])

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error('Loan name required')
      return
    }
    const amt = rupeesToPaise(parseRupees(amount))
    if (amt <= 0) {
      toast.error('Enter a valid outstanding amount')
      return
    }
    setSaving(true)
    const row: Partial<Loan> = { name: name.trim(), amount: amt }
    try {
      if (loan) {
        await updateLoan.mutateAsync({ id: loan.id, row })
        toast.success('Loan updated')
      } else {
        await createLoan.mutateAsync({ row })
        toast.success('Loan added')
      }
      onClose()
    } catch {
      toast.error('Failed to save loan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={loan ? 'Edit loan' : 'Add loan'}>
      <div className="space-y-4">
        <Field.Input
          label="Loan name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bike loan"
          required
        />
        <Field.Input
          label="Outstanding amount (₹)"
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
          is calculated as Investments − Loans.
        </p>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={onSubmit} loading={saving}>
            {loan ? 'Save changes' : 'Add loan'}
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
