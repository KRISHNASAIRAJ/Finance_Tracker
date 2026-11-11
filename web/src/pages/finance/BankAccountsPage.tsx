/**
 * BankAccountsPage — CRUD for bank accounts + balance editing, with the
 * wallets in the same section (they are cash and count towards the liquid
 * balance and the net worth).
 */
import { useState } from 'react'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useBankAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '../../hooks/data/useBankAccounts'
import { useWallets, useUpsertWallet, WALLET_PROVIDERS } from '../../hooks/data/useWallets'
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
  const { data: wallets } = useWallets(userId)
  const upsertWallet = useUpsertWallet(userId)

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

  const accountsTotal = (accounts ?? []).reduce((s, a) => s + a.amount, 0)
  const walletTotal = (wallets ?? []).reduce((s, w) => s + w.amount, 0)
  // Wallets are cash — they count towards the liquid balance.
  const totalBalance = accountsTotal + walletTotal

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Bank accounts"
        subtitle={`${paiseToRupees(totalBalance)} total · ${paiseToRupees(accountsTotal)} in accounts · ${paiseToRupees(walletTotal)} in wallets`}
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

      {/* Wallets — the same section as the bank accounts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#59D6C7]" />
            <p className="text-sm font-semibold text-white">Wallets</p>
          </div>
          <p className="text-xs text-white/40">{paiseToRupees(walletTotal)} total</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(wallets ?? []).length === 0 && (
            <p className="text-sm text-white/30 py-2 text-center sm:col-span-2 lg:col-span-3">No wallets</p>
          )}
          {(wallets ?? []).map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-sm text-white/80">{w.name}</p>
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={(w.amount / 100).toString()}
                onBlur={(e) => {
                  const rupees = parseFloat(e.target.value)
                  const amount = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0
                  if (amount !== w.amount) upsertWallet.mutate({ id: w.id, name: w.name, amount })
                }}
                className="h-9 w-24 rounded-lg border border-white/10 bg-white/5 px-2 text-right text-sm text-white/80"
              />
            </div>
          ))}
          {WALLET_PROVIDERS.filter((p) => !(wallets ?? []).some((w) => w.id === p.id)).map((p) => (
            <button
              key={p.id}
              onClick={() => upsertWallet.mutate({ id: p.id, name: p.name, amount: 0 })}
              className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-3 text-left text-sm text-white/40 hover:border-white/20 hover:text-white/70"
            >
              <Plus className="h-3.5 w-3.5" /> {p.name}
            </button>
          ))}
        </div>
      </Card>

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