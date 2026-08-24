import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useBankAccounts } from '../../hooks/data/useBankAccounts'
import { useCreditCards } from '../../hooks/data/useCreditCards'
import { useReceivables } from '../../hooks/data/useReceivables'
import { useTransactions } from '../../hooks/data/useTransactions'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

export function BalanceSummaryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: accounts, isLoading: accLoading } = useBankAccounts(userId)
  const { data: cards } = useCreditCards(userId)
  const { data: receivables } = useReceivables(userId)
  const { data: txns } = useTransactions(userId)

  const totalBalance = (accounts ?? []).reduce((s, a) => s + a.amount, 0)
  const totalOutstanding = (cards ?? []).reduce((s, c) => s + (c.current_outstanding ?? c.balance ?? 0), 0)

  const lentOut = useMemo(
    () =>
      (receivables ?? [])
        .filter((r) => r.type === 'lent' && (r.paid_amount ?? 0) < r.amount)
        .reduce((s, r) => s + (r.amount - (r.paid_amount ?? 0)), 0),
    [receivables]
  )

  const borrowedOut = useMemo(
    () =>
      (receivables ?? [])
        .filter((r) => r.type === 'borrowed' && (r.paid_amount ?? 0) < r.amount)
        .reduce((s, r) => s + (r.amount - (r.paid_amount ?? 0)), 0),
    [receivables]
  )

  const currentMonth = istMonthKey()
  const monthSpend = (txns ?? [])
    .filter((t) => t.type !== 'income' && t.date.slice(0, 7) === currentMonth)
    .reduce((s, t) => s + t.amount, 0)

  const netWorth = totalBalance - totalOutstanding + lentOut - borrowedOut

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Balance summary" subtitle="Net worth across accounts, cards, and lending" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/50">Net worth</p>
            <p className={`mt-1 text-4xl font-bold tracking-tight tnum ${netWorth >= 0 ? 'text-white' : 'text-[#FF887D]'}`}>
              {paiseToRupees(netWorth)}
            </p>
          </div>
          <p className="text-xs text-white/35 hidden sm:block">balance − outstanding + lent − borrowed</p>
        </Card>
      </div>

      {accLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-white/50">Bank balance</p>
            <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupees(totalBalance)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-white/50">Card outstanding</p>
            <p className="mt-1 text-2xl font-bold text-[#FF887D] tnum">{paiseToRupees(totalOutstanding)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-white/50">Lent out</p>
            <p className="mt-1 text-2xl font-bold text-[#59D6C7] tnum">{paiseToRupees(lentOut)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-white/50">Borrowed</p>
            <p className="mt-1 text-2xl font-bold text-[#E2A45C] tnum">{paiseToRupees(borrowedOut)}</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Bank accounts"
            action={<span className="text-xs text-white/40">{accounts?.length ?? 0} accounts</span>}
          />
          <CardBody className="space-y-3">
            {(accounts ?? []).length === 0 && <p className="text-sm text-white/30 py-4 text-center">No bank accounts</p>}
            {(accounts ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                <p className="text-sm text-white/80">{a.title}</p>
                <p className="text-sm font-semibold text-white tnum">{paiseToRupees(a.amount)}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Credit cards"
            action={<span className="text-xs text-white/40">{cards?.length ?? 0} cards</span>}
          />
          <CardBody className="space-y-3">
            {(cards ?? []).length === 0 && <p className="text-sm text-white/30 py-4 text-center">No credit cards</p>}
            {(cards ?? []).map((c) => {
              const outstanding = c.current_outstanding ?? c.balance ?? 0
              return (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm text-white/80">{c.name}</p>
                    <p className="text-xs text-white/40">•••• {c.ending_with}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#FF887D] tnum">{paiseToRupees(outstanding)}</p>
                </div>
              )
            })}
          </CardBody>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/50">This month spend</p>
            <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupeesCompact(monthSpend)}</p>
          </div>
          <p className="text-xs text-white/35">{currentMonth}</p>
        </div>
      </Card>
    </div>
  )
}