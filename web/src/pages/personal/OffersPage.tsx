import { useMemo, useState } from 'react'
import { Pencil, Plus, Ticket, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useOffers, useUpsertOffer, useDeleteOffer } from '../../hooks/data/useOffers'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/utils'
import type { Offer } from '../../types'

const CATEGORIES = ['Shopping', 'Food', 'Travel', 'Entertainment', 'Fuel', 'Bills', 'Other']

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string): number {
  const ms = new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${todayIst()}T00:00:00Z`).getTime()
  return Math.round(ms / 86400000)
}

export function OffersPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: offers, isLoading } = useOffers(userId)
  const upsert = useUpsertOffer(userId)
  const del = useDeleteOffer(userId)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Offer | undefined>()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [minSpendRupees, setMinSpendRupees] = useState('')
  const [expiresOn, setExpiresOn] = useState(todayIst())
  const [notes, setNotes] = useState('')

  const { active, expired } = useMemo(() => {
    const list = offers ?? []
    return {
      active: list.filter((o) => daysUntil(o.expires_on) >= 0).sort((a, b) => a.expires_on.localeCompare(b.expires_on)),
      expired: list.filter((o) => daysUntil(o.expires_on) < 0).sort((a, b) => b.expires_on.localeCompare(a.expires_on)),
    }
  }, [offers])

  const openCreate = () => {
    setEditing(undefined)
    setTitle('')
    setMerchant('')
    setCategory('')
    setCouponCode('')
    setDiscountValue('')
    setMinSpendRupees('')
    setExpiresOn(todayIst())
    setNotes('')
    setFormOpen(true)
  }

  const openEdit = (offer: Offer) => {
    setEditing(offer)
    setTitle(offer.title)
    setMerchant(offer.merchant ?? '')
    setCategory(offer.category ?? '')
    setCouponCode(offer.coupon_code ?? '')
    setDiscountValue(offer.discount_value ?? '')
    setMinSpendRupees(offer.min_spend_paise ? String(offer.min_spend_paise / 100) : '')
    setExpiresOn(offer.expires_on)
    setNotes(offer.notes ?? '')
    setFormOpen(true)
  }

  const save = async () => {
    if (!title.trim()) { toast.error('Offer title required'); return }
    if (!expiresOn) { toast.error('Expiry date required'); return }
    setSaving(true)
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        row: {
          title: title.trim(),
          merchant: merchant.trim() || null,
          category: category || null,
          coupon_code: couponCode.trim() || null,
          discount_value: discountValue.trim() || null,
          min_spend_paise: minSpendRupees.trim() ? Math.round(parseFloat(minSpendRupees) * 100) || null : null,
          expires_on: expiresOn,
          notes: notes.trim() || null,
        },
      })
      toast.success(editing ? 'Offer updated' : 'Offer added')
      setFormOpen(false)
    } catch { toast.error('Failed to save offer') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Offer deleted') }
    catch { toast.error('Failed to delete offer') }
    setDeleting(null)
  }

  const renderOffer = (offer: Offer, isExpired: boolean) => {
    const days = daysUntil(offer.expires_on)
    const urgent = !isExpired && days <= 3
    return (
      <Card key={offer.id} className={cn('group p-5', isExpired && 'opacity-55')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn('text-sm font-semibold text-white', isExpired && 'line-through')}>{offer.title}</p>
              {offer.discount_value && (
                <span className="rounded-full bg-[#9BA5FF] px-2.5 py-0.5 text-[11px] font-bold text-black">
                  {offer.discount_value}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
              {offer.merchant && <span className="rounded-md bg-white/5 px-2 py-0.5">{offer.merchant}</span>}
              {offer.category && <span className="rounded-md bg-white/5 px-2 py-0.5">{offer.category}</span>}
              {offer.min_spend_paise ? (
                <span className="rounded-md bg-white/5 px-2 py-0.5">
                  Min ₹{(offer.min_spend_paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              ) : null}
              <span className={cn('rounded-md px-2 py-0.5', urgent ? 'bg-[#FF887D]/15 font-semibold text-[#FF887D]' : 'bg-white/5')}>
                {isExpired
                  ? `Expired ${fmtDate(offer.expires_on)}`
                  : days === 0
                    ? 'Expires today!'
                    : days === 1
                      ? 'Expires tomorrow'
                      : `Expires ${fmtDate(offer.expires_on)} · ${days}d left`}
              </span>
            </div>
            {offer.coupon_code && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#9BA5FF]/40 bg-[#9BA5FF]/10 px-2.5 py-1 text-xs font-bold tracking-wider text-[#9BA5FF]">
                <Ticket className="h-3.5 w-3.5" /> {offer.coupon_code}
              </span>
            )}
            {offer.notes && <p className="text-xs text-white/50">{offer.notes}</p>}
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => openEdit(offer)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleting(offer.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Offers"
        subtitle={`${active.length} active · reminders 3 & 2 days before expiry`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add offer
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (offers ?? []).length === 0 ? (
        <EmptyState title="No offers saved" subtitle="Track coupon codes and expiry dates — Meals and sleep are covered; offers notify you before they lapse." />
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Active ({active.length})</p>
              {active.map((o) => renderOffer(o, false))}
            </div>
          )}
          {expired.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Expired ({expired.length})</p>
              {expired.map((o) => renderOffer(o, true))}
            </div>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit offer' : 'Add offer'}
        subtitle={editing ? 'Update this offer' : 'Save a coupon before you forget it'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : 'Add offer'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10% off on Amazon Pay" />
          <div className="grid grid-cols-2 gap-3">
            <Field.Input label="Merchant / bank" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. HDFC, Swiggy" />
            <Field.Input label="Expiry date" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </div>
          <Field.Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[{ value: '', label: 'None' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field.Input label="Discount" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="e.g. 20% off" />
            <Field.Input label="Min spend (₹)" value={minSpendRupees} onChange={(e) => setMinSpendRupees(e.target.value)} placeholder="e.g. 999" inputMode="decimal" />
          </div>
          <Field.Input label="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE200" />
          <Field.Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, where to use..." />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete offer"
        message="This offer and its reminders will be removed."
        loading={del.isPending}
      />
    </div>
  )
}
