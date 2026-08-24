import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, PieChart } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useHoldings } from '../../hooks/data/useInvestments'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Donut } from '../../components/charts/Charts'
import { Badge, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { formatNumber, paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { allocCategoryOf } from './WealthDashboardPage'

const ALLOC_COLORS = ['#9BA5FF', '#59D6C7', '#BCE85D', '#E2A45C', '#FF887D', '#a78bfa']

export function AllocationDetailPage() {
  const { cat } = useParams()
  const category = cat ? decodeURIComponent(cat) : ''
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: holdings, isLoading } = useHoldings(userId)

  const filtered = useMemo(
    () => (holdings ?? []).filter((h) => allocCategoryOf(h) === category),
    [holdings, category]
  )

  const totalValue = filtered.reduce((s, h) => s + (h.current_value ?? h.quantity * (h.current_price ?? 0)), 0)
  const totalCost = filtered.reduce((s, h) => s + h.quantity * h.avg_buy_price, 0)
  const totalPnL = totalValue - totalCost
  const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  const donutData = useMemo(
    () =>
      filtered.map((h, i) => ({
        name: h.symbol,
        value: h.current_value ?? h.quantity * (h.current_price ?? 0),
        color: ALLOC_COLORS[i % ALLOC_COLORS.length],
      })),
    [filtered]
  )

  return (
    <div className="fade-up space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/wealth"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={category}
          subtitle={`${filtered.length} holdings in this allocation category`}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={PieChart} title="No holdings in this category" subtitle="Add a holding with this allocation category" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Total value" value={paiseToRupees(totalValue)} />
            <StatCard label="Total cost" value={paiseToRupees(totalCost)} />
            <StatCard
              label="Total P&L"
              value={`${totalPnL >= 0 ? '+' : '−'}${paiseToRupees(Math.abs(totalPnL))}`}
              change={`${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`}
              color={totalPnL >= 0 ? '#59D6C7' : '#FF887D'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={`Holdings in ${category}`} />
              <CardBody className="px-0 py-0">
                {filtered.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/80">{h.symbol}</p>
                      <p className="text-xs text-white/35">
                        Qty {formatNumber(h.quantity)} · Avg {paiseToRupees(h.avg_buy_price)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-white tnum">
                      {paiseToRupees(h.current_value ?? h.quantity * (h.current_price ?? 0))}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Breakdown" />
              <CardBody>
                <Donut data={donutData} height={190} formatter={paiseToRupeesCompact} />
                <div className="mt-3 space-y-1.5">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="flex-1 truncate text-white/60">{d.name}</span>
                      <span className="font-medium text-white/80">{paiseToRupeesCompact(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge color="#9BA5FF">{category}</Badge>
            <Link to="/wealth/holdings/new" className="text-xs text-white/40 transition-colors hover:text-white">
              + Add holding to this category
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
