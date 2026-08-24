import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions } from '../../hooks/data/useTransactions'
import { useFuelFills } from '../../hooks/data/useGarage'
import { PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { TrendBars, Donut } from '../../components/charts/Charts'
import { getCategory } from '../../lib/categoryMap'
import { formatMonthKey, paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthlySpendPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: txns, isLoading } = useTransactions(userId)
  const { data: fills } = useFuelFills(userId)

  const [selectedMonth, setSelectedMonth] = useState(istMonthKey())

  const monthTxns = useMemo(
    () => (txns ?? []).filter((t) => t.date.slice(0, 7) === selectedMonth),
    [txns, selectedMonth]
  )

  // Same as mobile app: garage fuel fills count toward monthly spend
  const monthFuelFills = useMemo(
    () => (fills ?? []).filter((f) => f.date.slice(0, 7) === selectedMonth),
    [fills, selectedMonth]
  )
  const fuelFillTotal = monthFuelFills.reduce((s, f) => s + f.amount, 0)
  const fuelTxnTotal = monthTxns
    .filter((t) => t.type === 'fuel_purchase')
    .reduce((s, t) => s + t.amount, 0)
  const spend = monthTxns
    .filter((t) => t.type !== 'income' && t.type !== 'fuel_purchase' && t.type !== 'fixed_expense')
    .reduce((s, t) => s + t.amount, 0) + Math.max(fuelFillTotal, fuelTxnTotal)
  const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const net = income - spend

  const dailyData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const days: Array<{ label: string; value: number }> = []
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${selectedMonth}-${String(d).padStart(2, '0')}`
      const total = monthTxns
        .filter((t) => t.date.slice(0, 10) === key && t.type !== 'income')
        .reduce((s, t) => s + t.amount, 0)
      days.push({ label: String(d), value: total })
    }
    return days
  }, [monthTxns, selectedMonth])

  const catData = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxns) {
      if (t.type === 'income') continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: getCategory(name).color }))
      .sort((a, b) => b.value - a.value)
  }, [monthTxns])

  const avgPerDay = spend > 0 ? Math.round(spend / new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate()) : 0

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Monthly spend"
        subtitle="Daily spend, totals, and category breakdown for the month"
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total spend" value={paiseToRupees(spend)} />
            <StatCard label="Income" value={paiseToRupees(income)} color="#59D6C7" />
            <StatCard label="Net" value={paiseToRupees(net)} color={net >= 0 ? '#59D6C7' : '#FF887D'} />
            <StatCard label="Avg per day" value={paiseToRupees(avgPerDay)} />
          </div>

          <Card>
            <CardHeader title="Daily spend" subtitle={formatMonthKey(selectedMonth)} />
            <CardBody>
              <TrendBars data={dailyData} height={200} color="#9BA5FF" formatter={paiseToRupeesCompact} />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Category breakdown" />
              <CardBody>
                <Donut data={catData} height={180} formatter={paiseToRupeesCompact} />
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Top categories" />
              <CardBody className="space-y-3">
                {catData.length === 0 && <p className="text-sm text-white/30 py-4 text-center">No spending this month</p>}
                {catData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-white/30">{i + 1}</span>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 truncate text-sm text-white/70">{c.name}</span>
                    <span className="text-sm font-semibold text-white tnum">{paiseToRupees(c.value)}</span>
                    <span className="w-14 text-right text-xs text-white/40">{spend > 0 ? `${Math.round((c.value / spend) * 100)}%` : '—'}</span>
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