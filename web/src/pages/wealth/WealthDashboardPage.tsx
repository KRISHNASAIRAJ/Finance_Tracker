import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, Plus, RefreshCw, Sparkles, Target } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useHoldings,
  useInvestmentGoals,
  useRefreshPrices,
  investKeys,
} from '../../hooks/data/useInvestments'
import {
  usePortfolioActionPlan,
  useSavePortfolioActionPlan,
} from '../../hooks/data/useMisc'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Donut } from '../../components/charts/Charts'
import { Button } from '../../components/ui/Button'
import { PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { Field } from '../../components/ui/Field'
import { formatDate, paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { Holding } from '../../types'

const ALLOC_COLORS = ['#9BA5FF', '#59D6C7', '#BCE85D', '#E2A45C', '#FF887D', '#a78bfa']

export function allocCategoryOf(h: Holding): string {
  return h.allocation_category ?? (h.type === 'mf' ? 'Mutual Funds' : h.type === 'etf' ? 'ETF' : 'Equity')
}

export function WealthDashboardPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const qc = useQueryClient()
  const { data: holdings, isLoading } = useHoldings(userId)
  const { data: goals } = useInvestmentGoals(userId)
  const { data: plan } = usePortfolioActionPlan(userId)
  const savePlan = useSavePortfolioActionPlan(userId)
  const refreshPrices = useRefreshPrices()

  const [draft, setDraft] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => {
    setDraft(plan ?? '')
  }, [plan])

  const portfolioValue = useMemo(
    () =>
      (holdings ?? []).reduce(
        (s, h) => s + (h.current_value ?? h.quantity * (h.current_price ?? 0)),
        0
      ),
    [holdings]
  )

  const todayPnL = useMemo(
    () =>
      (holdings ?? []).reduce(
        (s, h) =>
          s + (h.prev_close != null ? h.quantity * ((h.current_price ?? 0) - h.prev_close) : 0),
        0
      ),
    [holdings]
  )

  const totalCost = useMemo(
    () => (holdings ?? []).reduce((s, h) => s + h.quantity * h.avg_buy_price, 0),
    [holdings]
  )

  const totalReturn = portfolioValue - totalCost
  const returnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

  const allocationData = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of holdings ?? []) {
      const cat = allocCategoryOf(h)
      const value = h.current_value ?? h.quantity * (h.current_price ?? 0)
      map.set(cat, (map.get(cat) ?? 0) + value)
    }
    let idx = 0
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: ALLOC_COLORS[idx++ % ALLOC_COLORS.length] }))
  }, [holdings])

  const handleRefresh = async () => {
    try {
      await refreshPrices.mutateAsync()
      await qc.invalidateQueries({ queryKey: investKeys.holdings(userId) })
      toast.success('Prices refreshed')
    } catch {
      toast.error('Failed to refresh prices')
    }
  }

  const handleSavePlan = async () => {
    setSavingPlan(true)
    try {
      await savePlan.mutateAsync(draft)
      toast.success('Action plan saved')
    } catch {
      toast.error('Failed to save action plan')
    } finally {
      setSavingPlan(false)
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Wealth"
        subtitle={`${holdings?.length ?? 0} holdings · ${goals?.length ?? 0} goals`}
        action={
          <Link to="/wealth/holdings/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add holding
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleRefresh} loading={refreshPrices.isPending}>
          <RefreshCw className="h-4 w-4" /> Refresh prices
        </Button>
        <Link to="/wealth/history">
          <Button size="sm" variant="secondary" className="gap-1.5">
            <History className="h-4 w-4" /> View history
          </Button>
        </Link>
        <Link to="/wealth/ai">
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> AI recommendations
          </Button>
        </Link>
        <Link to="/wealth/goals">
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Target className="h-4 w-4" /> Goals
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Portfolio value" value={paiseToRupees(portfolioValue)} />
          <StatCard
            label="Today's P&L"
            value={`${todayPnL >= 0 ? '+' : '−'}${paiseToRupees(Math.abs(todayPnL))}`}
            color={todayPnL >= 0 ? '#59D6C7' : '#FF887D'}
          />
          <StatCard label="Total cost" value={paiseToRupees(totalCost)} />
          <StatCard
            label="Total return"
            value={`${totalReturn >= 0 ? '+' : '−'}${paiseToRupees(Math.abs(totalReturn))}`}
            change={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`}
            color={totalReturn >= 0 ? '#59D6C7' : '#FF887D'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Asset allocation" subtitle="By allocation category" />
          <CardBody>
            <Donut data={allocationData} height={190} formatter={paiseToRupeesCompact} />
            <div className="mt-3 space-y-1.5">
              {allocationData.length === 0 && (
                <p className="py-2 text-center text-sm text-white/30">No holdings yet</p>
              )}
              {allocationData.map((c) => (
                <Link
                  key={c.name}
                  to={`/wealth/allocation/${encodeURIComponent(c.name)}`}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition-colors hover:bg-white/5"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 truncate text-white/60">{c.name}</span>
                  <span className="font-medium text-white/80">{paiseToRupeesCompact(c.value)}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Goals"
            subtitle="Investment goal progress"
            action={
              <Link to="/wealth/goals/new" className="text-xs text-white/40 transition-colors hover:text-white">
                + Add goal
              </Link>
            }
          />
          <CardBody>
            {(goals ?? []).length === 0 ? (
              <p className="py-2 text-center text-sm text-white/30">No investment goals</p>
            ) : (
              <div className="space-y-4">
                {(goals ?? []).map((g) => {
                  const pct =
                    g.target_amount > 0
                      ? Math.min(100, (g.current_progress / g.target_amount) * 100)
                      : 0
                  return (
                    <div key={g.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm text-white/75">{g.goal_name}</p>
                        <p className="text-xs text-white/40">{pct.toFixed(0)}%</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#9BA5FF] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-white/35">
                        {paiseToRupeesCompact(g.current_progress)} of {paiseToRupeesCompact(g.target_amount)}
                        {g.target_date && ` · ${formatDate(g.target_date)}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Action plan"
          subtitle="Your plan for this portfolio"
          action={
            <Button size="sm" onClick={handleSavePlan} loading={savingPlan}>
              Save
            </Button>
          }
        />
        <CardBody>
          <Field.Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Increase SIP to ₹10k, rebalance Gold to 15%..."
          />
        </CardBody>
      </Card>
    </div>
  )
}
