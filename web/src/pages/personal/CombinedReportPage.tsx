import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useBankAccounts } from '../../hooks/data/useBankAccounts'
import { useCreditCards } from '../../hooks/data/useCreditCards'
import { useReceivables } from '../../hooks/data/useReceivables'
import { useHoldings } from '../../hooks/data/useInvestments'
import { useTransactions } from '../../hooks/data/useTransactions'
import { useFuelFills, useMaintenanceLogs } from '../../hooks/data/useGarage'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Donut } from '../../components/charts/Charts'
import { getCategory, getCategoryIcon } from '../../lib/categoryMap'
import { formatDate, paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

const ALLOC_COLORS = ['#9BA5FF', '#59D6C7', '#BCE85D', '#E2A45C', '#FF887D', '#a78bfa', '#5ee6ff', '#f472b6', '#22d3ee']

export function CombinedReportPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: accounts } = useBankAccounts(userId)
  const { data: cards } = useCreditCards(userId)
  const { data: receivables } = useReceivables(userId)
  const { data: holdings } = useHoldings(userId)
  const { data: txns } = useTransactions(userId)
  const { data: fuelFills } = useFuelFills(userId)
  const { data: maintenanceLogs } = useMaintenanceLogs(userId)

  const totalBalance = (accounts ?? []).reduce((s, a) => s + (a.amount ?? 0), 0)
  const totalCardOutstanding = (cards ?? []).reduce((s, c) => s + (c.balance ?? c.current_outstanding ?? 0), 0)
  const portfolioValue = (holdings ?? []).reduce((s, h) => s + (h.current_value ?? (h.quantity * (h.current_price ?? 0))), 0)
  const lentOutstanding = (receivables ?? [])
    .filter((r) => r.type === 'lent' && r.status !== 'paid')
    .reduce((s, r) => s + (r.amount - (r.paid_amount ?? 0)), 0)
  const borrowedOutstanding = (receivables ?? [])
    .filter((r) => r.type === 'borrowed' && r.status !== 'paid')
    .reduce((s, r) => s + (r.amount - (r.paid_amount ?? 0)), 0)
  const netWorth = totalBalance - totalCardOutstanding + portfolioValue + lentOutstanding - borrowedOutstanding

  const monthKey = istMonthKey()
  const monthTxns = useMemo(() => (txns ?? []).filter((t) => t.date.slice(0, 7) === monthKey), [txns, monthKey])
  const monthSpendCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTxns) {
      if (['expense', 'fuel_purchase', 'vehicle_service', 'fixed_expense'].includes(t.type))
        map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: getCategory(name).color }))
      .sort((a, b) => b.value - a.value)
  }, [monthTxns])
  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthGarage = (fuelFills ?? [])
    .filter((f) => f.date.slice(0, 7) === monthKey)
    .reduce((s, f) => s + f.amount, 0) +
    (maintenanceLogs ?? [])
      .filter((m) => m.date.slice(0, 7) === monthKey)
      .reduce((s, m) => s + m.amount, 0)

  const allocationData = useMemo(() => {
    const items: Array<{ name: string; value: number; color: string }> = []
    const catMap = new Map<string, number>()
    for (const h of holdings ?? []) {
      const cat = h.allocation_category ?? 'Other'
      catMap.set(cat, (catMap.get(cat) ?? 0) + (h.current_value ?? (h.quantity * (h.current_price ?? 0))))
    }
    let idx = 0
    for (const [name, value] of catMap) {
      if (value > 0) items.push({ name, value, color: ALLOC_COLORS[idx++ % ALLOC_COLORS.length] })
    }
    if (totalBalance > 0) items.push({ name: 'Bank Balance', value: totalBalance, color: ALLOC_COLORS[idx++ % ALLOC_COLORS.length] })
    if (totalCardOutstanding > 0) items.push({ name: 'Card Debt', value: totalCardOutstanding, color: '#FF887D' })
    return items
  }, [holdings, totalBalance, totalCardOutstanding])

  const recentTxns = (txns ?? []).filter((t) => t.type !== 'credit_card_bill').slice(0, 5)

  const isLoading = !txns || !accounts || !cards || !receivables || !holdings

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Combined Report" subtitle="Full financial overview across all modules" />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-2">
              <p className="text-xs font-medium text-white/50">Net Worth</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tnum" style={{ color: netWorth >= 0 ? '#59D6C7' : '#FF887D' }}>
                {paiseToRupees(netWorth)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/50">
                <div><span className="text-white/70">Balance</span> {paiseToRupeesCompact(totalBalance)}</div>
                <div><span className="text-white/70">Cards</span> −{paiseToRupeesCompact(totalCardOutstanding)}</div>
                <div><span className="text-white/70">Portfolio</span> {paiseToRupeesCompact(portfolioValue)}</div>
                <div><span className="text-white/70">Lent/Borrowed</span> {paiseToRupeesCompact(lentOutstanding - borrowedOutstanding)}</div>
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-white/50">Month Spend</p>
              <p className="mt-1 text-2xl font-bold text-white tnum">
                {paiseToRupeesCompact(monthSpendCat.reduce((s, c) => s + c.value, 0))}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-white/50">Month Income</p>
              <p className="mt-1 text-2xl font-bold text-[#59D6C7] tnum">
                {paiseToRupeesCompact(monthIncome)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-white/50">Garage Spend</p>
              <p className="mt-1 text-2xl font-bold text-[#E2A45C] tnum">
                {paiseToRupeesCompact(monthGarage)}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Allocation" subtitle="Portfolio, bank & cards" />
              <CardBody>
                <Donut data={allocationData} height={200} formatter={paiseToRupeesCompact} />
                <div className="mt-3 space-y-1.5">
                  {allocationData.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="flex-1 truncate text-white/60">{c.name}</span>
                      <span className="font-medium text-white/80">{paiseToRupeesCompact(c.value)}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Month Spend by Category" />
              <CardBody>
                <Donut data={monthSpendCat} height={200} formatter={paiseToRupeesCompact} />
                <div className="mt-3 space-y-1.5">
                  {monthSpendCat.slice(0, 8).map((c) => {
                    const Icon = getCategoryIcon(c.name)
                    return (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5 text-white/40" />
                        <span className="flex-1 truncate text-white/60">{c.name}</span>
                        <span className="font-medium text-white/80">{paiseToRupeesCompact(c.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent Activity" />
            <CardBody>
              {recentTxns.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/30">No transactions</p>
              ) : (
                recentTxns.map((t) => {
                  const Icon = getCategoryIcon(t.category)
                  return (
                    <div key={t.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                      <Icon className="h-4 w-4 shrink-0 text-white/30" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white/80">{t.category}</p>
                        <p className="text-xs text-white/35">{formatDate(t.date)}</p>
                      </div>
                      <span className={`text-sm font-medium tnum ${t.type === 'income' ? 'text-[#59D6C7]' : 'text-white'}`}>
                        {t.type === 'income' ? '+' : '−'}{paiseToRupees(t.amount)}
                      </span>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}