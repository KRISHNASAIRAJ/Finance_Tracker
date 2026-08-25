/**
 * HomePage — fold.money-style 3-column dashboard.
 * Left: upcoming reminders · Center: balance + trend + allocation · Right: recent transactions
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTransactions } from '../hooks/data/useTransactions'
import { useBankAccounts } from '../hooks/data/useBankAccounts'
import { useCreditCards } from '../hooks/data/useCreditCards'
import { useFixedExpenses } from '../hooks/data/useFixedExpenses'
import { useReceivables } from '../hooks/data/useReceivables'
import { useHoldings } from '../hooks/data/useInvestments'
import { useFuelFills } from '../hooks/data/useGarage'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/Shared'
import { TrendArea } from '../components/charts/Charts'
import { getCategoryIcon } from '../lib/categoryMap'
import { formatDate, paiseToRupees, paiseToRupeesCompact } from '../lib/format'
import { istMonthKey, istNow } from '../lib/istDate'
import type { Transaction } from '../types'

function getLast30DaysTotals(transactions: Transaction[] | undefined) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  let spent = 0
  let income = 0
  for (const t of transactions ?? []) {
    const d = new Date(t.date).getTime()
    if (d < cutoff) continue
    if (t.type === 'income' || t.type === 'lent') income += t.amount
    else if (t.type !== 'credit_card_bill') spent += t.amount
  }
  return { spent, income }
}

export function HomePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: txns } = useTransactions(userId)
  const { data: accounts } = useBankAccounts(userId)
  const { data: cards } = useCreditCards(userId)
  const { data: fixed } = useFixedExpenses(userId)
  const { data: receivables } = useReceivables(userId)
  const { data: holdings } = useHoldings(userId)
  const { data: fuelFills } = useFuelFills(userId)

  const totalBalance = (accounts ?? []).reduce((s, a) => s + (a.amount ?? 0), 0)
  const totalCardOutstanding = (cards ?? []).reduce((s, c) => s + (c.balance ?? c.current_outstanding ?? 0), 0)
  const portfolioValue = (holdings ?? []).reduce(
    (s, h) => s + (h.current_value ?? (h.quantity * (h.current_price ?? 0))),
    0
  )
  const netWorth = totalBalance - totalCardOutstanding + portfolioValue

  const monthKey = istMonthKey()
  const monthTxns = useMemo(
    () => (txns ?? []).filter((t) => t.date.slice(0, 7) === monthKey),
    [txns, monthKey]
  )
  const monthSpend = useMemo(() => {
    // Same as mobile app's getMonthlyExpenses() — excludes fixed exp names,
    // rent/sip/wallet categories, adds garage fuel fills
    const excluded = new Set([
      'rent', 'sip', 'investments', 'housing', 'wallet loads', 'wallet load',
      ...(fixed ?? []).map((f) => f.name.toLowerCase()),
    ])
    const spendTypes = new Set(['expense', 'fuel_purchase', 'vehicle_service'])
    const monthTxs = (txns ?? []).filter(
      (t) =>
        t.date.slice(0, 7) === monthKey &&
        spendTypes.has(t.type) &&
        !excluded.has(t.category.toLowerCase())
    )
    let total = monthTxs.reduce((s, t) => s + t.amount, 0)
    const fuelTxAmount = monthTxs
      .filter((t) => t.type === 'fuel_purchase')
      .reduce((s, t) => s + t.amount, 0)
    const fuelFillAmount = (fuelFills ?? [])
      .filter((f) => f.date.slice(0, 7) === monthKey)
      .reduce((s, f) => s + f.amount, 0)
    if (fuelFillAmount > fuelTxAmount) {
      total += fuelFillAmount - fuelTxAmount
    }
    return total
  }, [txns, monthKey, fixed, fuelFills])
  const monthIncome = monthTxns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

  // 30-day trend for chart
  const trend = useMemo(() => {
    const days: Array<{ label: string; value: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(istNow().getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const total = (txns ?? [])
        .filter((t) => t.date.slice(0, 10) === key && t.type !== 'credit_card_bill')
        .reduce((s, t) => s + t.amount, 0)
      days.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: total })
    }
    return days
  }, [txns])

  const { spent: spent30, income: income30 } = getLast30DaysTotals(txns)

  // Upcoming reminders: fixed expenses by billing day this month + due receivables
  const upcomingFixed = useMemo(() => {
    const now = istNow()
    const today = now.getDate()
    return (fixed ?? [])
      .filter((f) => f.billing_day >= today - 1 && f.billing_day <= today + 14)
      .slice(0, 5)
  }, [fixed])

  const dueReceivables = useMemo(
    () =>
      (receivables ?? [])
        .filter((r) => r.status !== 'paid' && new Date(r.due_date).getTime() >= Date.now() - 86400000)
        .slice(0, 4),
    [receivables]
  )

  const recentTxns = (txns ?? []).filter((t) => t.type !== 'credit_card_bill').slice(0, 8)

  return (
    <div className="space-y-6 fade-up">
      {/* Row of stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Balance" value={paiseToRupeesCompact(totalBalance)} />
        <StatCard
          label="Card Outstanding"
          value={paiseToRupeesCompact(totalCardOutstanding)}
          change={totalCardOutstanding > 0 ? undefined : 'clear'}
        />
        <StatCard
          label="Portfolio"
          value={paiseToRupeesCompact(portfolioValue)}
          color="#9BA5FF"
        />
        <StatCard
          label="Net Worth"
          value={paiseToRupeesCompact(netWorth)}
          color={netWorth >= 0 ? '#59D6C7' : '#FF887D'}
        />
      </div>

      {/* 3-column main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left — upcoming */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-sm font-semibold text-white">Upcoming bills</h3>
              <Link to="/finance/fixed" className="text-xs text-white/40 hover:text-white">
                View all
              </Link>
            </div>
            <div className="px-5 py-3">
              {upcomingFixed.length === 0 && (
                <p className="py-6 text-center text-sm text-white/30">No upcoming bills</p>
              )}
              {upcomingFixed.map((f) => {
                const CatIcon = getCategoryIcon(f.category)
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0"
                  >
                    <CatIcon className="h-4 w-4 text-white/30" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/80">{f.name}</p>
                      <p className="text-xs text-white/35">Due day {f.billing_day}</p>
                    </div>
                    <span className="text-sm font-medium text-white">{paiseToRupees(f.amount)}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-sm font-semibold text-white">Lent / borrowed</h3>
              <Link to="/finance/lent" className="text-xs text-white/40 hover:text-white">
                View all
              </Link>
            </div>
            <div className="px-5 py-3">
              {dueReceivables.length === 0 && (
                <p className="py-6 text-center text-sm text-white/30">Nothing outstanding</p>
              )}
              {dueReceivables.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0"
                >
                  {r.type === 'lent' ? (
                    <ArrowUpRight className="h-4 w-4 text-[#59D6C7]" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4 text-[#FF887D]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/80">{r.person_name}</p>
                    <p className="text-xs text-white/35">{formatDate(r.due_date)}</p>
                  </div>
                  <span className="text-sm font-medium text-white">{paiseToRupees(r.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center — balance + trend */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="px-5 pt-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">This month</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-white tnum">
                    {paiseToRupees(monthSpend)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white/50">Income</p>
                  <p className="mt-1 text-lg font-semibold text-[#59D6C7] tnum">
                    {paiseToRupeesCompact(monthIncome)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <TrendArea data={trend} height={110} color="#9BA5FF" formatter={paiseToRupeesCompact} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-white/10">
              <div className="px-5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Spent · 30d</p>
                <p className="text-sm font-semibold text-white">{paiseToRupeesCompact(spent30)}</p>
              </div>
              <div className="border-l border-white/10 px-5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Inflow · 30d</p>
                <p className="text-sm font-semibold text-[#59D6C7]">{paiseToRupeesCompact(income30)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white/50">Net Worth</p>
                <p className="mt-1 text-3xl font-bold tracking-tight tnum" style={{ color: netWorth >= 0 ? '#59D6C7' : '#FF887D' }}>
                  {paiseToRupees(netWorth)}
                </p>
              </div>
              <Link
                to="/more/report"
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white"
              >
                Full report <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>

        {/* Right — recent transactions */}
        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold text-white">Recent transactions</h3>
            <Link to="/finance/transactions" className="text-xs text-white/40 hover:text-white">
              View all
            </Link>
          </div>
          <div className="px-5 py-3">
            {recentTxns.length === 0 && (
              <p className="py-6 text-center text-sm text-white/30">No transactions yet</p>
            )}
            {recentTxns.map((t) => {
              const CatIcon = getCategoryIcon(t.category)
              const isOut = t.type !== 'income'
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0"
                >
                  <CatIcon className="h-4 w-4 text-white/30" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/80">{t.category}</p>
                    <p className="text-xs text-white/35">{formatDate(t.date)}</p>
                  </div>
                  <span className={`text-sm font-medium tnum ${isOut ? 'text-white' : 'text-[#59D6C7]'}`}>
                    {isOut ? '−' : '+'}
                    {paiseToRupees(t.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}