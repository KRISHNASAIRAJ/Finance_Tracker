/**
 * CreditCardsPage + CreditCardDetailPage — CRUD, bill tracking, AMC.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, MessageCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCreditCards, useCreateCard, useUpdateCard, useDeleteCard } from '../../hooks/data/useCreditCards'
import { usePayCardBill, useTransactions } from '../../hooks/data/useTransactions'
import { PageHeader, EmptyState, Skeleton, Badge } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate, paiseToRupees, parseRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { CreditCard } from '../../types'

const NETWORKS = ['VISA', 'Mastercard', 'RuPay', 'Amex'] as const

export function CreditCardsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: cards, isLoading } = useCreditCards(userId)
  const createCard = useCreateCard(userId)
  const updateCard = useUpdateCard(userId)
  const deleteCard = useDeleteCard(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<CreditCard>>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', network: 'VISA', ending_with: '', billing_day: 1, due_date: '', balance: 0, bank: '', card_limit: undefined })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name || !form.network || !form.ending_with) {
      toast.error('Name, network, and last 4 digits required')
      return
    }
    setSaving(true)
    try {
      const row: Partial<CreditCard> = {
        name: form.name,
        network: form.network as CreditCard['network'],
        ending_with: form.ending_with,
        billing_day: form.billing_day ?? 1,
        due_date: form.due_date ?? '',
        balance: form.balance ?? 0,
        bank: form.bank || null,
        card_limit: form.card_limit || null,
        annual_charge: form.annual_charge || 0,
        is_ltf: form.is_ltf || false,
      }
      if (editing) {
        await updateCard.mutateAsync({ id: editing, row })
        toast.success('Card updated')
      } else {
        await createCard.mutateAsync({ row })
        toast.success('Card added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteCard.mutateAsync(deleting)
      toast.success('Card deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setDeleting(null)
  }

  const totalOutstanding = (cards ?? []).reduce((s, c) => s + (c.balance ?? c.current_outstanding ?? 0), 0)

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Credit cards"
        subtitle={`${paiseToRupees(totalOutstanding)} outstanding across ${cards?.length ?? 0} cards`}
        action={
          <div className="flex gap-2">
            <Link to="/finance/cards/assistant">
              <Button variant="secondary" size="sm" className="gap-1.5"><MessageCircle className="h-4 w-4" /> Card assistant</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-4 w-4" /> Add card</Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (cards ?? []).length === 0 ? (
        <EmptyState icon={Plus} title="No credit cards" subtitle="Add your credit cards to track bills, due dates, and AMC" action={<Button variant="secondary" size="sm" onClick={openNew}>Add card</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(cards ?? []).map((c) => {
            const outstanding = c.balance ?? c.current_outstanding ?? 0
            const limit = c.card_limit
            const usagePct = limit && limit > 0 ? Math.round((outstanding / limit) * 100) : 0
            return (
              <Link key={c.id} to={`/finance/cards/${c.id}`}>
                <Card className="p-5 group hover:border-white/25 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <Badge className="text-[10px]">{c.network}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-white/40">•••• {c.ending_with}{c.bank ? ` · ${c.bank}` : ''}</p>
                      <p className="mt-3 text-2xl font-bold text-white tnum">{paiseToRupees(outstanding)}</p>
                      {limit && limit > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-white/10">
                            <div className="h-1.5 rounded-full" style={{ width: `${usagePct}%`, backgroundColor: usagePct > 80 ? '#FF887D' : '#9BA5FF' }} />
                          </div>
                          <span className="text-[11px] text-white/40">{usagePct}% used</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit card' : 'Add card'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <Field.Input label="Card name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. HDFC Millennia" />
          <Field.Select label="Network" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value as CreditCard['network'] })} options={NETWORKS.map((n) => ({ value: n, label: n }))} />
          <Field.Input label="Last 4 digits" value={form.ending_with ?? ''} onChange={(e) => setForm({ ...form, ending_with: e.target.value })} placeholder="1234" maxLength={4} />
          <Field.Input label="Bank" value={form.bank ?? ''} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="HDFC" />
          <Field.Input label="Billing day" type="number" min={1} max={31} value={form.billing_day ?? 1} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) })} />
          <Field.Input label="Due date" type="date" value={form.due_date?.slice(0, 10) ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Field.Input label="Balance (₹)" type="number" step="0.01" value={form.balance ? String(form.balance / 100) : '0'} onChange={(e) => setForm({ ...form, balance: rupeesToPaise(parseRupees(e.target.value)) })} />
          <Field.Input label="Card limit (₹)" type="number" step="0.01" value={form.card_limit ? String(form.card_limit / 100) : ''} onChange={(e) => setForm({ ...form, card_limit: rupeesToPaise(parseRupees(e.target.value)) })} />
          <Field.Input label="Annual charge (₹)" type="number" step="0.01" value={form.annual_charge ? String(form.annual_charge / 100) : '0'} onChange={(e) => setForm({ ...form, annual_charge: rupeesToPaise(parseRupees(e.target.value)) })} />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={form.is_ltf ?? false} onChange={(e) => setForm({ ...form, is_ltf: e.target.checked })} className="rounded border-white/20 bg-white/5" />
            Lifetime free
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete card" message="This card and its tracking data will be removed." loading={deleteCard.isPending} />
    </div>
  )
}

export function CreditCardDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  return <CreditCardDetailInner cardId={id} userId={userId} />
}

function CreditCardDetailInner({ cardId, userId }: { cardId?: string; userId: string }) {
  const { data: cards } = useCreditCards(userId)
  const { data: txns } = useTransactions(userId)
  const payBill = usePayCardBill(userId)

  const card = (cards ?? []).find((c) => c.id === cardId)
  if (!card) return <Skeleton className="h-64 w-full" />

  const cardTxns = (txns ?? []).filter((t) => t.linked_card_id === cardId || t.notes?.includes(card.name)).slice(0, 20)
  const outstanding = card.balance ?? card.current_outstanding ?? 0
  const billAmount = card.bill_amount ?? card.balance ?? 0
  const paidAmount = card.paid_amount ?? 0
  const dueSoon = card.due_date && new Date(card.due_date).getTime() < Date.now() + 7 * 86400000

  const handlePayBill = async () => {
    try {
      await payBill.mutateAsync({ cardId: card.id, cardName: card.name, billAmount, paidAmount: billAmount })
      toast.success('Bill marked as paid')
    } catch {
      toast.error('Failed to mark bill paid')
    }
  }

  return (
    <div className="fade-up space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{card.name}</h1>
          <p className="text-sm text-white/40">{card.network} · •••• {card.ending_with}{card.bank ? ` · ${card.bank}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/finance/cards/${card.id}/chat`}>
            <Button variant="secondary" size="sm" className="gap-1.5"><MessageCircle className="h-4 w-4" /> T&C Chat</Button>
          </Link>
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={handlePayBill} loading={payBill.isPending}>
            Pay bill
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-white">{paiseToRupees(outstanding)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Bill amount</p>
          <p className="mt-1 text-2xl font-bold text-white">{paiseToRupees(billAmount)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Paid</p>
          <p className="mt-1 text-2xl font-bold text-[#59D6C7]">{paiseToRupees(paidAmount)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Due date</p>
          <p className={`mt-1 text-lg font-bold ${dueSoon ? 'text-[#FF887D]' : 'text-white'}`}>{card.due_date ? formatDate(card.due_date) : '—'}</p>
        </Card>
      </div>

      {card.card_limit && card.card_limit > 0 && (
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50 mb-2">Credit utilization</p>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (outstanding / card.card_limit) * 100)}%`, backgroundColor: outstanding > card.card_limit * 0.8 ? '#FF887D' : '#9BA5FF' }} />
          </div>
          <p className="mt-1 text-xs text-white/40">{paiseToRupees(outstanding)} of {paiseToRupees(card.card_limit)}</p>
        </Card>
      )}

      {card.annual_charge && card.annual_charge > 0 && (
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Annual charge (AMC)</p>
          <p className="mt-1 text-lg font-bold text-white">{paiseToRupees(card.annual_charge)}{card.is_ltf ? ' · LTF' : ''}{card.annual_charge_date ? ` · due ${formatDate(card.annual_charge_date)}` : ''}</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Recent transactions on this card" />
        <CardBody>
          {cardTxns.length === 0 && <p className="text-sm text-white/30">No linked transactions</p>}
          {cardTxns.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
              <div>
                <p className="text-sm text-white/80">{t.category}</p>
                <p className="text-xs text-white/40">{formatDate(t.date)}</p>
              </div>
              <span className="text-sm font-medium text-white">{paiseToRupees(t.amount)}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}