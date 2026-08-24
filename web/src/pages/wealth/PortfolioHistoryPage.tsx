import { useMemo, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  usePortfolioSnapshots,
  useDeleteSnapshot,
} from '../../hooks/data/useInvestments'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { TrendLine } from '../../components/charts/Charts'
import { EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { ConfirmDialog } from '../../components/ui/Modal'
import { formatDate, formatPct, paiseToRupees } from '../../lib/format'
import { toast } from '../../components/ui/Toast'

export function PortfolioHistoryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: snapshots, isLoading } = usePortfolioSnapshots(userId)
  const deleteSnapshot = useDeleteSnapshot(userId)

  const [deleting, setDeleting] = useState<string | null>(null)

  const chartData = useMemo(
    () => (snapshots ?? []).map((s) => ({ label: formatDate(s.date), value: s.total_value })),
    [snapshots]
  )

  const latest = (snapshots ?? []).length > 0 ? (snapshots ?? [])[(snapshots ?? []).length - 1] : null

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteSnapshot.mutateAsync(deleting)
      toast.success('Snapshot deleted')
    } catch {
      toast.error('Failed to delete snapshot')
    }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Portfolio history"
        subtitle="Snapshots captured daily at 8:30 PM IST"
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (snapshots ?? []).length === 0 ? (
        <EmptyState
          icon={History}
          title="No snapshots yet"
          subtitle="Snapshots are recorded automatically at 8:30 PM IST each day"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Latest value" value={paiseToRupees(latest?.total_value ?? 0)} />
            <StatCard
              label="Latest day change"
              value={`${(latest?.day_change ?? 0) >= 0 ? '+' : '−'}${paiseToRupees(Math.abs(latest?.day_change ?? 0))}`}
              color={(latest?.day_change ?? 0) >= 0 ? '#59D6C7' : '#FF887D'}
            />
            <StatCard
              label="Latest day change %"
              value={formatPct(latest?.day_change_pct ?? 0)}
              color={(latest?.day_change_pct ?? 0) >= 0 ? '#59D6C7' : '#FF887D'}
            />
          </div>

          <Card>
            <CardHeader title="Portfolio value over time" />
            <CardBody>
              <TrendLine data={chartData} color="#9BA5FF" height={220} formatter={paiseToRupees} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Snapshots" />
            <CardBody className="px-0 py-0">
              {[...(snapshots ?? [])].reverse().map((s) => (
                <div key={s.date} className="group flex items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80">{formatDate(s.date)}</p>
                    <p className="text-xs text-white/35">
                      {s.day_change != null && (
                        <span className={s.day_change >= 0 ? 'text-[#59D6C7]' : 'text-[#FF887D]'}>
                          {s.day_change >= 0 ? '+' : '−'}{paiseToRupees(Math.abs(s.day_change))}
                        </span>
                      )}
                      {s.day_change_pct != null && <> · {formatPct(s.day_change_pct)}</>}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white tnum">{paiseToRupees(s.total_value)}</p>
                  <button
                    onClick={() => setDeleting(s.date)}
                    className="rounded-lg p-1.5 text-white/30 opacity-0 transition-opacity hover:bg-white/10 hover:text-[#FF887D] group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete snapshot"
        message="This portfolio snapshot will be permanently removed."
        loading={deleteSnapshot.isPending}
      />
    </div>
  )
}
