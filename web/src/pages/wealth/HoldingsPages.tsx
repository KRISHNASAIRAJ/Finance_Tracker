import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useHoldings,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
} from '../../hooks/data/useInvestments'
import { Badge, EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatNumber, paiseToRupees, paiseToRupeesDetailed, parseRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { Holding, HoldingType } from '../../types'

const TYPE_OPTIONS = [
  { value: 'equity', label: 'Equity' },
  { value: 'mf', label: 'Mutual Fund' },
  { value: 'etf', label: 'ETF' },
  { value: 'other', label: 'Other' },
]

const TYPE_COLORS: Record<HoldingType, string> = {
  equity: '#9BA5FF',
  mf: '#59D6C7',
  etf: '#E2A45C',
  other: '#a78bfa',
}

const ALLOC_CATEGORIES = ['Gold', 'Realty', 'Equity', 'Mutual Funds', 'ETF', 'Other']

function holdingValue(h: Holding): number {
  return h.current_value ?? h.quantity * (h.current_price ?? 0)
}

function holdingPnLPct(h: Holding): number {
  const cost = h.quantity * h.avg_buy_price
  if (cost <= 0) return 0
  return ((holdingValue(h) - cost) / cost) * 100
}

export function HoldingsListPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: holdings, isLoading } = useHoldings(userId)
  const deleteHolding = useDeleteHolding(userId)

  const [deleting, setDeleting] = useState<string | null>(null)

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteHolding.mutateAsync(deleting)
      toast.success('Holding deleted')
    } catch {
      toast.error('Failed to delete holding')
    }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Holdings"
        subtitle={`${holdings?.length ?? 0} positions`}
        action={
          <Link to="/wealth/holdings/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add holding
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (holdings ?? []).length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No holdings"
          subtitle="Add your first equity, MF or ETF position"
          action={
            <Link to="/wealth/holdings/new">
              <Button variant="secondary" size="sm">Add holding</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {(holdings ?? []).map((h) => {
            const value = holdingValue(h)
            const pnlPct = holdingPnLPct(h)
            return (
              <div key={h.id} className="group flex items-center gap-4 border-b border-white/5 px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-white/85">{h.symbol}</p>
                    <Badge color={TYPE_COLORS[h.type]}>{h.type.toUpperCase()}</Badge>
                    {h.allocation_category && <Badge>{h.allocation_category}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/35">{h.fund_name ?? '—'}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Qty {formatNumber(h.quantity)} · Avg {paiseToRupeesDetailed(h.avg_buy_price)} · Curr {h.current_price != null ? paiseToRupeesDetailed(h.current_price) : '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-white tnum">{paiseToRupees(value)}</p>
                  <p className={`text-xs font-medium ${pnlPct >= 0 ? 'text-[#59D6C7]' : 'text-[#FF887D]'}`}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    to={`/wealth/holdings/${h.id}/edit`}
                    className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => setDeleting(h.id)}
                    className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete holding"
        message="This holding and its valuation will be removed."
        loading={deleteHolding.isPending}
      />
    </div>
  )
}

export function HoldingFormPage() {
  const { id } = useParams()
  return <HoldingForm id={id} />
}

function HoldingForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: holdings, isLoading } = useHoldings(userId)
  const createHolding = useCreateHolding(userId)
  const updateHolding = useUpdateHolding(userId)

  const existing = id ? (holdings ?? []).find((h) => h.id === id) : undefined

  const [symbol, setSymbol] = useState('')
  const [fundName, setFundName] = useState('')
  const [type, setType] = useState<HoldingType>('equity')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [allocationCategory, setAllocationCategory] = useState('')
  const [folio, setFolio] = useState('')
  const [amc, setAmc] = useState('')
  const [sipAmount, setSipAmount] = useState('')
  const [sipDay, setSipDay] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setSymbol(existing.symbol)
    setFundName(existing.fund_name ?? '')
    setType(existing.type)
    setQuantity(String(existing.quantity))
    setAvgPrice(String(existing.avg_buy_price / 100))
    setCurrentPrice(existing.current_price != null ? String(existing.current_price / 100) : '')
    setAllocationCategory(existing.allocation_category ?? '')
    setFolio(existing.folio_number ?? '')
    setAmc(existing.amc ?? '')
    setSipAmount(existing.sip_amount != null ? String(existing.sip_amount / 100) : '')
    setSipDay(existing.sip_day != null ? String(existing.sip_day) : '')
  }, [id, existing])

  const onSubmit = async () => {
    if (!symbol.trim()) {
      toast.error('Symbol required')
      return
    }
    const qty = parseFloat(quantity)
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setSaving(true)
    const row: Partial<Holding> = {
      symbol: symbol.trim().toUpperCase(),
      fund_name: fundName.trim() || null,
      type,
      quantity: qty,
      avg_buy_price: rupeesToPaise(parseRupees(avgPrice)),
      current_price: currentPrice.trim() ? rupeesToPaise(parseRupees(currentPrice)) : null,
      allocation_category: allocationCategory.trim() || null,
      folio_number: folio.trim() || null,
      amc: amc.trim() || null,
      sip_amount: sipAmount.trim() ? rupeesToPaise(parseRupees(sipAmount)) : null,
      sip_day: sipDay.trim() ? parseInt(sipDay, 10) : null,
      source: 'manual',
    }
    try {
      if (existing) {
        await updateHolding.mutateAsync({ id: existing.id, row })
        toast.success('Holding updated')
      } else {
        await createHolding.mutateAsync({ row })
        toast.success('Holding added')
      }
      navigate('/wealth/holdings')
    } catch {
      toast.error('Failed to save holding')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading && id) {
    return (
      <div className="fade-up space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader
        title={existing ? 'Edit holding' : 'Add holding'}
        subtitle={existing ? 'Update this position' : 'Add a new position to your portfolio'}
      />

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field.Input
            label="Symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. RELIANCE"
            required
          />
          <Field.Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as HoldingType)}
            options={TYPE_OPTIONS}
          />
        </div>

        <Field.Input
          label="Fund name (optional)"
          value={fundName}
          onChange={(e) => setFundName(e.target.value)}
          placeholder="e.g. HDFC Midcap Opportunities"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field.Input
            label="Quantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="10"
            required
          />
          <Field.Input
            label="Avg buy price (₹)"
            type="number"
            step="0.01"
            min="0"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder="0.00"
            required
          />
          <Field.Input
            label="Current price (₹)"
            type="number"
            step="0.01"
            min="0"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alloc-cat" className="block text-xs font-medium text-white/60">
            Allocation category
          </label>
          <input
            id="alloc-cat"
            list="alloc-categories"
            value={allocationCategory}
            onChange={(e) => setAllocationCategory(e.target.value)}
            placeholder="Gold, Realty, Equity..."
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/30 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10"
          />
          <datalist id="alloc-categories">
            {ALLOC_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field.Input
            label="Folio number (optional)"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="MF folio"
          />
          <Field.Input
            label="AMC (optional)"
            value={amc}
            onChange={(e) => setAmc(e.target.value)}
            placeholder="e.g. HDFC"
          />
          <Field.Input
            label="SIP day (optional)"
            type="number"
            min="1"
            max="31"
            value={sipDay}
            onChange={(e) => setSipDay(e.target.value)}
            placeholder="e.g. 5"
          />
        </div>

        <Field.Input
          label="SIP amount (₹, optional)"
          type="number"
          step="0.01"
          min="0"
          value={sipAmount}
          onChange={(e) => setSipAmount(e.target.value)}
          placeholder="0.00"
        />

        <div className="flex gap-3">
          <Button className="flex-1" onClick={onSubmit} loading={saving}>
            {existing ? 'Save changes' : 'Add holding'}
          </Button>
          <Link to="/wealth/holdings" className="flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
