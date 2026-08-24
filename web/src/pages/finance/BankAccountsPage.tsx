/**
 * BankAccountsPage — CRUD for bank accounts + balance editing.
 */
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useBankAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '../../hooks/data/useBankAccounts'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { paiseToRupees, parseRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'

export function BankAccountsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: accounts, isLoading } = useBankAccounts(userId)
  const createAccount = useCreateAccount(userId)
  const updateAccount = useUpdateAccount(userId)
  const deleteAccount = useDeleteAccount(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [balance, setBalance] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setTitle('')
    setBalance('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const acc = (accounts ?? []).find((a) => a.id === id)
    if (!acc) return
    setEditing(id)
    setTitle(acc.title)
    setBalance(String(acc.amount / 100))
    setModalOpen(true)
  }

  const save = async () => {
    if (!title.trim()) {
      toast.error('Account name required')
      return
    }
    setSaving(true)
    try {
      const row = { title: title.trim(), amount: rupeesToPaise(parseRupees(balance)) }
      if (editing) {
        await updateAccount.mutateAsync({ id: editing, row })
        toast.success('Account updated')
      } else {
        await createAccount.mutateAsync({ row })
        toast.success('Account added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteAccount.mutateAsync(deleting)
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account')
    }
    setDeleting(null)
  }

  const totalBalance = (accounts ?? []).reduce((s, a) => s + a.amount, 0)

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Bank accounts"
        subtitle={`${paiseToRupees(totalBalance)} total across ${accounts?.length ?? 0} accounts`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (accounts ?? []).length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No bank accounts"
          subtitle="Add your bank accounts to track balances"
          action={<Button variant="secondary" size="sm" onClick={openNew}>Add account</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts ?? []).map((a) => (
            <Card key={a.id} className="p-5 group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70">{a.title}</p>
                  <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupees(a.amount)}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(a.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleting(a.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit account' : 'Add account'}
        subtitle={editing ? 'Update the account details' : 'Create a new bank account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Account name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HDFC Savings" />
          <Field.Input label="Current balance (₹)" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete account"
        message="This account and its balance will be removed."
        loading={deleteAccount.isPending}
      />
    </div>
  )
}