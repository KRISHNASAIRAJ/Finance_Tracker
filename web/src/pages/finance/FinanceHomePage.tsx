/**
 * FinanceHomePage — the finance module dashboard.
 * Shows: month spend, budget, recent transactions, category donut, quick actions.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Trash2, Settings2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions } from '../../hooks/data/useTransactions'
import { useBankAccounts } from '../../hooks/data/useBankAccounts'
import { useUserSettings, useCategoryBudgets, useUpsertCategoryBudget, useDeleteCategoryBudget } from '../../hooks/data/useMisc'
import { useFixedExpenses } from '../../hooks/data/useFixedExpenses'
import { useFuelFills } from '../../hooks/data/useGarage'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { TrendArea, Donut } from '../../components/charts/Charts'
import { Button } from '../../components/ui/Button'
import { getCategory } from '../../lib/categoryMap'
import { formatDate, paiseToRupees, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'
import type { FixedExpense, FuelFill, Transaction } from '../../types'

/** Matches the mobile app's getMonthlyExpenses() logic exactly. */
function computeMonthSpend(
  txns: Transaction[] | undefined,
  fixedExpenses: FixedExpense[] | undefined,
  fuelFills: FuelFill[] | undefined
): number {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const excluded = new Set([
    'rent', 'sip', 'investments', 'housing', 'wallet loads', 'wallet load',
    ...(fixedExpenses ?? []).map((f) => f.name.toLowerCase()),
  ])

  const spendTypes = new Set(['expense', 'fuel_purchase', 'vehicle_service'])
  const monthTxs = (txns ?? []).filter(
    (tx) =>
      new Date(tx.date) >= startOfMonth &&
      spendTypes.has(tx.type) &&
      !excluded.has(tx.category.toLowerCase())
  )

  let total = monthTxs.reduce((acc, tx) => acc + tx.amount, 0)

  const fuelTxAmount = monthTxs
    .filter((tx) => tx.type === 'fuel_purchase')
    .reduce((acc, tx) => acc + tx.amount, 0)

  // Same as app: include garage fuel fills not already counted as fuel txns
  const fuelFillAmount = (fuelFills ?? [])
    .filter((f) => new Date(f.date) >= startOfMonth)
    .reduce((sum, f) => sum + f.amount, 0)
  if (fuelFillAmount > fuelTxAmount) {
    total += fuelFillAmount - fuelTxAmount
  }

  return total
}

export function FinanceHomePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: txns } = useTransactions(userId)
  const { data: accounts } = useBankAccounts(userId)
  const { data: settings } = useUserSettings(userId)
  const { data: fixedExpenses } = useFixedExpenses(userId)
  const { data: fuelFills } = useFuelFills(userId)
  const { data: categoryBudgets } = useCategoryBudgets(userId)
  const upsertBudget = useUpsertCategoryBudget(userId)
  const deleteBudget = useDeleteCategoryBudget(userId)

  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetCat, setBudgetCat] = useState('')
  const [budgetAmt, setBudgetAmt] = useState('')

  const monthKey = istMonthKey()
  const monthTxns = useMemo(() => (txns ?? []).filter((t) => t.date.slice(0, 7) === monthKey), [txns, monthKey])
  const monthSpend = useMemo(
    () => computeMonthSpend(txns ?? [], fixedExpenses ?? [], fuelFills ?? []),
    [txns, fixedExpenses, fuelFills]
  )
  const monthIncome = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const budget = (settings?.monthly_budget ?? 0) * 100
  const budgetRemaining = budget - monthSpend

  // Category breakdown
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

  // 30-day trend
  const trend = useMemo(() => {
    const days: Array<{ label: string; value: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const total = (txns ?? [])
        .filter((t) => t.date.slice(0, 10) === key && t.type !== 'income')
        .reduce((s, t) => s + t.amount, 0)
      days.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: total })
    }
    return days
  }, [txns])

  const recentTxns = (txns ?? []).filter((t) => t.type !== 'credit_card_bill').slice(0, 6)

  // Category limits: spent this month vs limit, with progress
  const budgetRows = useMemo(() => {
    const spent = new Map<string, number>()
    for (const t of monthTxns) {
      if (t.type === 'income' || t.type === 'credit_card_bill') continue
      spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount)
    }
    return (categoryBudgets ?? [])
      .map((b) => {
        const used = spent.get(b.category) ?? 0
        return {
          category: b.category,
          limit: b.amount_paise,
          used,
          pct: b.amount_paise > 0 ? Math.min(100, (used / b.amount_paise) * 100) : 0,
          over: used > b.amount_paise,
        }
      })
      .sort((a, b) => b.used - a.used)
  }, [categoryBudgets, monthTxns])

  const openBudgetModal = (category: string) => {
    const existing = categoryBudgets?.find((b) => b.category === category)
    setBudgetCat(category)
    setBudgetAmt(existing ? (existing.amount_paise / 100).toString() : '')
    setBudgetModalOpen(true)
  }

  const saveBudget = () => {
    const amt = parseFloat(budgetAmt)
    if (!budgetCat || isNaN(amt) || amt <= 0) return
    upsertBudget.mutate({ category: budgetCat, amountPaise: Math.round(amt * 100) })
    setBudgetModalOpen(false)
  }

  return (
    <div className="space-y-6 fade-up">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/finance/transactions/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add expense
          </Button>
        </Link>
        <Link to="/finance/accounts">
          <Button variant="secondary" size="sm">Accounts</Button>
        </Link>
        <Link to="/finance/cards">
          <Button variant="secondary" size="sm">Cards</Button>
        </Link>
        <Link to="/finance/lent">
          <Button variant="secondary" size="sm">Lent / Borrowed</Button>
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">This month spend</p>
          <p className="mt-1 text-2xl font-bold text-white">{paiseToRupeesCompact(monthSpend)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">This month income</p>
          <p className="mt-1 text-2xl font-bold text-[#59D6C7]">{paiseToRupeesCompact(monthIncome)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Budget</p>
          <p className="mt-1 text-2xl font-bold text-white">{paiseToRupeesCompact(budget)}</p>
          <p className={`mt-0.5 text-xs ${budgetRemaining >= 0 ? 'text-[#59D6C7]' : 'text-[#FF887D]'}`}>
            {budgetRemaining >= 0 ? `${paiseToRupeesCompact(budgetRemaining)} left` : `${paiseToRupeesCompact(-budgetRemaining)} over`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-white/50">Total balance</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {paiseToRupeesCompact((accounts ?? []).reduce((s, a) => s + a.amount, 0))}
          </p>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly spend trend" />
          <CardBody>
            <TrendArea data={trend} height={160} color="#9BA5FF" formatter={paiseToRupeesCompact} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Category breakdown" />
          <CardBody>
            <Donut data={catData} height={180} formatter={paiseToRupeesCompact} />
            <div className="mt-3 space-y-1.5">
              {catData.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-white/60 truncate flex-1">{c.name}</span>
                  <span className="text-white/80 font-medium">{paiseToRupeesCompact(c.value)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader
          title="Recent transactions"
          action={
            <Link to="/finance/transactions" className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody>
          {recentTxns.length === 0 && <p className="text-sm text-white/30 py-4 text-center">No transactions</p>}
          {recentTxns.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80">{t.category}</p>
                <p className="text-xs text-white/35">{formatDate(t.date)}</p>
              </div>
              <span className={`text-sm font-medium tnum ${t.type === 'income' ? 'text-[#59D6C7]' : 'text-white'}`}>
                {t.type === 'income' ? '+' : '−'}{paiseToRupees(t.amount)}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Category limits */}
      <Card>
        <CardHeader
          title="Category limits"
          action={
            <button
              onClick={() => openBudgetModal('')}
              className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add limit
            </button>
          }
        />
        <CardBody>
          {budgetRows.length === 0 && (
            <p className="text-sm text-white/30 py-4 text-center">No category limits set — add one to track spending.</p>
          )}
          {budgetRows.map((row) => {
            const cat = getCategory(row.category)
            return (
              <div key={row.category} className="border-b border-white/5 py-2.5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80">{row.category}</p>
                    <p className="text-xs text-white/35 tnum">
                      {paiseToRupeesCompact(row.used)} / {paiseToRupeesCompact(row.limit)} this month
                    </p>
                  </div>
                  <span className={`text-xs font-medium tnum ${row.over ? 'text-[#FF887D]' : 'text-white/60'}`}>
                    {row.over ? 'Over limit' : `${Math.round(row.pct)}%`}
                  </span>
                  <button
                    onClick={() => openBudgetModal(row.category)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={`Edit ${row.category} limit`}
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteBudget.mutate(row.category)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-[#FF887D]"
                    aria-label={`Delete ${row.category} limit`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${row.pct}%`,
                      backgroundColor: row.over ? '#FF887D' : cat.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </CardBody>
      </Card>

      <Modal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title={budgetCat ? `Edit ${budgetCat} limit` : 'Add category limit'}
        footer={
          <>
            <button
              onClick={() => setBudgetModalOpen(false)}
              className="h-10 rounded-xl border border-white/15 px-4 text-sm text-white/70 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={saveBudget}
              disabled={upsertBudget.isPending}
              className="h-10 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50"
            >
              Save
            </button>
          </>
        }
      >
        <Field.Input
          label="Category"
          value={budgetCat}
          onChange={(e) => setBudgetCat(e.target.value)}
          placeholder="e.g. Food & Dining"
        />
        <Field.Input
          label="Monthly limit (₹)"
          type="number"
          value={budgetAmt}
          onChange={(e) => setBudgetAmt(e.target.value)}
          placeholder="e.g. 6000"
        />
      </Modal>
    </div>
  )
}