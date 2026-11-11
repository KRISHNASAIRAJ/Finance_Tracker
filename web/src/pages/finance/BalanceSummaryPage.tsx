import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useBankAccounts } from '../../hooks/data/useBankAccounts'
import { useCreditCards } from '../../hooks/data/useCreditCards'
import { useReceivables } from '../../hooks/data/useReceivables'
import { useTransactions } from '../../hooks/data/useTransactions'
import { useWallets, useUpsertWallet, useDeleteWallet, WALLET_PROVIDERS, RETIRED_WALLET_IDS } from '../../hooks/data/useWallets'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

export function BalanceSummaryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: accounts, isLoading: accLoading } = useBankAccounts(userId)
  const { data: cards } = useCreditCards(userId)
  const { data: receivables } = useReceivables(userId)
  const { data: txns } = useTransactions(userId)
  const { data: wallets } = useWallets(userId)
  const upsertWallet = useUpsertWallet(userId)
  const deleteWallet = useDeleteWallet(userId)
  const [selectedWalletId, setSelectedWalletId] = useState('')

  // Providers that left the catalog are hidden and removed from the cloud.
  const visibleWallets = (wallets ?? []).filter((w) => !RETIRED_WALLET_IDS.includes(w.id))
  useEffect(() => {
    for (const w of (wallets ?? []).filter((x) => RETIRED_WALLET_IDS.includes(x.id))) {
      deleteWallet.mutate(w.id)
    }
  }, [wallets, deleteWallet])

  const walletTotal = visibleWallets.reduce((s, w) => s + w.amount, 0)
  const missingWalletProviders = WALLET_PROVIDERS.filter(
    (p) => !visibleWallets.some((w) => w.id === p.id)
  )

  const accountsTotal = (accounts ?? []).reduce((s, a) => s + a.amount, 0)
  const totalBalance = accountsTotal + walletTotal
  const totalOutstanding = (cards ?? []).reduce((s, c) => s + (c.balance ?? c.current_outstanding ?? 0), 0)

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
            <p className="mt-1 text-2xl font-bold text-white tnum">{paiseToRupees(accountsTotal)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-white/50">Wallets</p>
            <p className="mt-1 text-2xl font-bold text-[#59D6C7] tnum">{paiseToRupees(walletTotal)}</p>
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
            title="Bank balances"
            action={
              <span className="text-xs text-white/40">
                {paiseToRupees(accountsTotal)} · {accounts?.length ?? 0} accounts
              </span>
            }
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

        {/* Wallets are their own section — they are cash and they count
            towards the balance and the net worth. */}
        <Card>
          <CardHeader
            title="Wallets"
            action={
              <span className="text-xs text-white/40">
                {paiseToRupees(walletTotal)} · {visibleWallets.length} wallets
              </span>
            }
          />
          <CardBody className="space-y-3">
            {visibleWallets.length === 0 && (
              <p className="text-sm text-white/30 py-4 text-center">No wallets</p>
            )}
            {visibleWallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm text-white/80">{w.name}</p>
                  <p className="text-xs text-white/35">Wallet</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white tnum">{paiseToRupees(w.amount)}</p>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={(w.amount / 100).toString()}
                    onBlur={(e) => {
                      const rupees = parseFloat(e.target.value)
                      const amount = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0
                      if (amount !== w.amount) upsertWallet.mutate({ id: w.id, name: w.name, amount })
                    }}
                    className="h-9 w-24 rounded-lg border border-white/10 bg-white/5 px-2 text-right text-sm text-white/80"
                  />
                </div>
              </div>
            ))}
            {missingWalletProviders.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white/80"
                >
                  {missingWalletProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => {
                    const provider = missingWalletProviders.find((p) => p.id === selectedWalletId)
                    if (!provider) return
                    upsertWallet.mutate({ id: provider.id, name: provider.name, amount: 0 })
                    setSelectedWalletId('')
                  }}
                >
                  Add wallet
                </Button>
              </div>
            )}
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
              const outstanding = c.balance ?? c.current_outstanding ?? 0
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