import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions, useCreateTransaction } from '../../hooks/data/useTransactions'
import { PageHeader, EmptyState, Skeleton, StatCard } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate, paiseToRupees, parseRupees, rupeesToPaise } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'

export function PayzappWalletPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: txns, isLoading } = useTransactions(userId)
  const createTxn = useCreateTransaction(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const loads = useMemo(
    () =>
      (txns ?? []).filter(
        (t) => t.type === 'expense' && (t.category === 'Wallet Loads' || (t.notes ?? '').toLowerCase().includes('payzapp'))
      ),
    [txns]
  )

  const currentMonth = istMonthKey()
  const monthLoads = useMemo(
    () => loads.filter((t) => t.date.slice(0, 7) === currentMonth),
    [loads, currentMonth]
  )
  const monthTotal = monthLoads.reduce((s, t) => s + t.amount, 0)
  const cashback = Math.round(monthTotal * 0.01)
  const allTimeTotal = loads.reduce((s, t) => s + t.amount, 0)

  const save = async () => {
    const paise = rupeesToPaise(parseRupees(amount))
    if (!paise || paise <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      await createTxn.mutateAsync({
        row: {
          type: 'expense',
          amount: paise,
          currency: 'INR',
          category: 'Wallet Loads',
          notes: 'Payzapp Wallet Load',
          source: 'manual',
          date: new Date().toISOString(),
        },
      })
      toast.success('Load added')
      setModalOpen(false)
      setAmount('')
    } catch {
      toast.error('Failed to add load')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Payzapp wallet"
        subtitle={`${paiseToRupees(monthTotal)} loaded this month`}
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add load
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="This month loads" value={paiseToRupees(monthTotal)} />
        <StatCard label="Cashback estimate (1%)" value={paiseToRupees(cashback)} color="#9BA5FF" />
        <StatCard label="All-time loads" value={paiseToRupees(allTimeTotal)} />
        <StatCard label="Loads this month" value={String(monthLoads.length)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : monthLoads.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No loads this month"
          subtitle="Add a Payzapp wallet load to start tracking"
          action={<Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add load</Button>}
        />
      ) : (
        <Card>
          <CardHeader title={`Loads in ${currentMonth}`} />
          <CardBody className="divide-y divide-white/5 p-0">
            {monthLoads.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <Wallet className="h-4 w-4 shrink-0 text-white/30" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80">Wallet load</p>
                  <p className="text-xs text-white/40">{formatDate(t.date)}</p>
                </div>
                <span className="text-sm font-semibold text-white tnum">−{paiseToRupees(t.amount)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add wallet load"
        subtitle="Add money to your Payzapp wallet"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Add</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          <p className="text-xs text-white/35">Recorded as an expense under "Wallet Loads".</p>
        </div>
      </Modal>
    </div>
  )
}