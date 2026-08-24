import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions } from '../../hooks/data/useTransactions'
import { useFixedExpenses } from '../../hooks/data/useFixedExpenses'
import { useReceivables } from '../../hooks/data/useReceivables'
import { PageHeader, Skeleton, Badge } from '../../components/ui/Shared'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { getCategory } from '../../lib/categoryMap'
import { formatMonthKey, formatPct, paiseToRupees } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function FinanceReportsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: txns, isLoading } = useTransactions(userId)
  const { data: fixed } = useFixedExpenses(userId)
  const { data: receivables } = useReceivables(userId)

  const [selectedMonth, setSelectedMonth] = useState(istMonthKey())

  const lastMonth = shiftMonth(selectedMonth, -1)

  const monthTxns = useMemo(
    () => (txns ?? []).filter((t) => t.date.slice(0, 7) === selectedMonth),
    [txns, selectedMonth]
  )
  const lastMonthTxns = useMemo(
    () => (txns ?? []).filter((t) => t.date.slice(0, 7) === lastMonth),
    [txns, lastMonth]
  )

  const spend = monthTxns.filter((t) => t.type !== 'income').reduce((s, t) => s + t.amount, 0)
  const lastSpend = lastMonthTxns.filter((t) => t.type !== 'income').reduce((s, t) => s + t.amount, 0)
  const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  const catSpend = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxns) {
      if (t.type === 'income') continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: getCategory(name).color }))
      .sort((a, b) => b.value - a.value)
  }, [monthTxns])

  const merchants = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>()
    for (const t of monthTxns) {
      const note = (t.notes ?? '').trim()
      if (t.type === 'income' || !note) continue
      const key = note.toLowerCase()
      const cur = map.get(key)
      if (cur) cur.value += t.amount
      else map.set(key, { name: note, value: t.amount })
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [monthTxns])

  const incomeSources = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxns) {
      if (t.type !== 'income') continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: getCategory(name).color }))
      .sort((a, b) => b.value - a.value)
  }, [monthTxns])

  const pendingReceivables = useMemo(
    () => (receivables ?? []).filter((r) => (r.paid_amount ?? 0) < r.amount),
    [receivables]
  )

  const pctChange = lastSpend > 0 ? ((spend - lastSpend) / lastSpend) * 100 : null
  const maxCat = catSpend.length > 0 ? catSpend[0].value : 1

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Spend analysis and insights"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[90px] text-center text-sm font-semibold text-white">{formatMonthKey(selectedMonth)}</span>
            <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Spend by category" subtitle={formatMonthKey(selectedMonth)} />
              <CardBody className="space-y-3">
                {catSpend.length === 0 && <p className="text-sm text-white/30 py-4 text-center">No spending this month</p>}
                {catSpend.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{c.name}</span>
                      <span className="font-semibold text-white tnum">{paiseToRupees(c.value)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (c.value / maxCat) * 100)}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Monthly comparison" subtitle={`${formatMonthKey(lastMonth)} vs ${formatMonthKey(selectedMonth)}`} />
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 p-4">
                    <p className="text-xs text-white/50">Last month</p>
                    <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupees(lastSpend)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-4">
                    <p className="text-xs text-white/50">This month</p>
                    <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupees(spend)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
                  {pctChange === null ? (
                    <span className="text-sm text-white/50">No spend last month to compare</span>
                  ) : pctChange <= 0 ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-[#59D6C7]" />
                      <span className="text-sm text-[#59D6C7]">{formatPct(pctChange)} vs last month</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-[#FF887D]" />
                      <span className="text-sm text-[#FF887D]">{formatPct(pctChange)} vs last month</span>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Top merchants" subtitle="Grouped by transaction notes" />
              <CardBody className="space-y-3">
                {merchants.length === 0 && <p className="text-sm text-white/30 py-4 text-center">No merchant data this month</p>}
                {merchants.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="truncate text-sm text-white/70">{m.name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10">
                        <div className="h-1.5 rounded-full bg-[#9BA5FF]" style={{ width: `${Math.max(4, (m.value / (merchants[0]?.value ?? 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white tnum">{paiseToRupees(m.value)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Income sources" subtitle={formatMonthKey(selectedMonth)} />
              <CardBody>
                {incomeSources.length === 0 ? (
                  <p className="text-sm text-white/30 py-4 text-center">No income this month</p>
                ) : (
                  <div className="space-y-3">
                    {incomeSources.map((c) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="flex-1 text-sm text-white/70">{c.name}</span>
                        <span className="text-sm font-semibold text-[#59D6C7] tnum">{paiseToRupees(c.value)}</span>
                      </div>
                    ))}
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/50">Total income</span>
                        <span className="text-sm font-bold text-[#59D6C7] tnum">{paiseToRupees(income)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Fixed expenses due" subtitle={formatMonthKey(selectedMonth)} />
              <CardBody className="space-y-2.5">
                {(fixed ?? []).length === 0 && <p className="text-sm text-white/30 py-4 text-center">No fixed expenses</p>}
                {(fixed ?? []).map((f) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-white/80">{f.name}</p>
                      <p className="text-xs text-white/40">Day {f.billing_day}</p>
                    </div>
                    <span className="text-sm font-semibold text-white tnum">{paiseToRupees(f.amount)}</span>
                  </div>
                ))}
                {(fixed ?? []).length > 0 && (
                  <div className="border-t border-white/10 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/50">Monthly total</span>
                      <span className="text-sm font-bold text-white tnum">{paiseToRupees((fixed ?? []).reduce((s, f) => s + f.amount, 0))}</span>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Lent / borrowed outstanding" action={<Badge>{pendingReceivables.length}</Badge>} />
              <CardBody className="space-y-2.5">
                {pendingReceivables.length === 0 && <p className="text-sm text-white/30 py-4 text-center">Nothing outstanding</p>}
                {pendingReceivables.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-white/80">{r.person_name}</p>
                      <p className="text-xs text-white/40">{r.type === 'lent' ? 'Lent' : 'Borrowed'}{r.due_date ? ` · due ${r.due_date.slice(0, 10)}` : ''}</p>
                    </div>
                    <span className={`text-sm font-semibold tnum ${r.type === 'lent' ? 'text-[#59D6C7]' : 'text-[#FF887D]'}`}>
                      {paiseToRupees(r.amount - (r.paid_amount ?? 0))}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}