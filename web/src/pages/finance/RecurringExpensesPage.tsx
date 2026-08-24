import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFixedExpenses } from '../../hooks/data/useFixedExpenses'
import { useTransactions } from '../../hooks/data/useTransactions'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { getCategoryIcon, getCategory } from '../../lib/categoryMap'
import { paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey, istDayOfMonth } from '../../lib/istDate'

export function RecurringExpensesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: fixed, isLoading: fixedLoading } = useFixedExpenses(userId)
  const { data: txns } = useTransactions(userId)

  const currentMonth = istMonthKey()
  const today = istDayOfMonth()

  const paidThisMonth = useMemo(() => {
    const paid = new Set<string>()
    for (const f of fixed ?? []) {
      if (f.last_paid_month === currentMonth) {
        paid.add(f.id)
      } else {
        const hasTxn = (txns ?? []).some(
          (t) => t.category === f.category && t.date.slice(0, 7) === currentMonth && t.amount === f.amount
        )
        if (hasTxn) paid.add(f.id)
      }
    }
    return paid
  }, [fixed, txns, currentMonth])

  const billsByDay = useMemo(() => {
    const map = new Map<number, typeof fixed>()
    for (const f of fixed ?? []) {
      const day = f.billing_day
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(f)
    }
    return map
  }, [fixed])

  const upcoming = useMemo(() => {
    const days: Array<{ day: number; bills: typeof fixed }> = []
    for (let i = 0; i < 7; i++) {
      const d = today + i
      if (d > 31) break
      const bills = billsByDay.get(d) ?? []
      if (bills.length > 0) days.push({ day: d, bills })
    }
    return days
  }, [billsByDay, today])

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Recurring expenses" subtitle="Monthly calendar view of fixed bills" />

      {fixedLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/70">All fixed expenses</h3>
            {(fixed ?? []).length === 0 ? (
              <p className="text-sm text-white/30">No fixed expenses yet</p>
            ) : (
              (fixed ?? []).map((f) => {
                const Icon = getCategoryIcon(f.category)
                return (
                  <Card key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-white/30" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/90">{f.name}</p>
                      <p className="text-xs text-white/40">Day {f.billing_day} · {f.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white tnum">{paiseToRupees(f.amount)}</p>
                      <p className={`text-[11px] ${paidThisMonth.has(f.id) ? 'text-[#59D6C7]' : 'text-white/30'}`}>
                        {paidThisMonth.has(f.id) ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* Right: calendar */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/70">Bill calendar</h3>
            <Card>
              <CardBody>
                <div className="grid grid-cols-7 gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-medium text-white/30 py-1">{d}</div>
                  ))}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const bills = billsByDay.get(day) ?? []
                    const isToday = day === today
                    return (
                      <div
                        key={day}
                        className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition-colors ${
                          isToday ? 'bg-white/15 text-white font-bold' : 'text-white/60 hover:bg-white/5'
                        } ${bills.length > 0 ? 'ring-1 ring-inset ring-white/10' : ''}`}
                      >
                        <span>{day}</span>
                        {bills.length > 0 && (
                          <div className="mt-0.5 flex gap-0.5">
                            {bills.slice(0, 3).map((b) => (
                              <span key={b.id} className="h-1 w-1 rounded-full" style={{ backgroundColor: getCategory(b.category).color }} />
                            ))}
                            {bills.length > 3 && <span className="text-[8px] text-white/40">+{bills.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>

            {upcoming.length > 0 && (
              <Card>
                <CardHeader title="Upcoming this week" />
                <CardBody className="space-y-3">
                  {upcoming.map(({ day, bills: bList }) => (
                    <div key={day}>
                      <p className="text-[11px] font-medium text-white/40 mb-1">Day {day}</p>
                      {(bList ?? []).map((b) => {
                        const Icon = getCategoryIcon(b.category)
                        const paid = paidThisMonth.has(b.id)
                        return (
                          <div key={b.id} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                            <Icon className="h-3 w-3 shrink-0 text-white/30" />
                            <span className="flex-1 text-sm text-white/80">{b.name}</span>
                            <span className="text-sm font-medium text-white tnum">{paiseToRupeesCompact(b.amount)}</span>
                            {paid && <span className="text-[10px] text-[#59D6C7]">Paid</span>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}