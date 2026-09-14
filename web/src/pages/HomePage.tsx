/**
 * HomePage — fold.money-style 3-column dashboard.
 * Left: upcoming reminders · Center: balance + trend + allocation · Right: recent transactions
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTransactions } from '../hooks/data/useTransactions'
import { useBankAccounts } from '../hooks/data/useBankAccounts'
import { useCreditCards } from '../hooks/data/useCreditCards'
import { useFixedExpenses } from '../hooks/data/useFixedExpenses'
import { useReceivables } from '../hooks/data/useReceivables'
import { useHoldings } from '../hooks/data/useInvestments'
import { useFuelFills } from '../hooks/data/useGarage'
import { useHabitLogs, useSleepLogs } from '../hooks/data/usePersonal'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/Shared'
import { TrendArea } from '../components/charts/Charts'
import { AnimatedNumber, staggerContainer, riseItem } from '../components/motion/shared'
import { SEO } from '../components/SEO'
import { getCategoryIcon } from '../lib/categoryMap'
import { formatDate, paiseToRupees, paiseToRupeesCompact } from '../lib/format'
import { istMonthKey, istNow } from '../lib/istDate'
import { quoteForDate, stressTechniquesForDate, PRINCIPLES } from '../lib/dailyContent'
import { HABITS, todayKey, parseHabits, dayProgress, habitStreak } from '../lib/habits'
import { supabase } from '../lib/supabase'
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
  const { data: habitLogs } = useHabitLogs(userId)
  const { data: sleepLogs } = useSleepLogs(userId)

  // Daily quote + habits (Home hero)
  const quote = quoteForDate()
  const techniques = stressTechniquesForDate()
  const today = todayKey()
  const habitByDay = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const l of habitLogs ?? []) m.set(l.log_date, parseHabits(l.habits))
    return m
  }, [habitLogs])
  const ticked = habitByDay.get(today) ?? []
  const habitPct = Math.round(dayProgress(ticked) * 100)
  const bestStreak = HABITS.reduce(
    (m, h) => Math.max(m, habitStreak(h.key, (k) => habitByDay.get(k) ?? [])),
    0
  )

  // Sleep info
  const sleepInfo = useMemo(() => {
    const sorted = [...(sleepLogs ?? [])].sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )
    const last = sorted[0] ?? null
    const last7 = sorted.slice(0, 7)
    const avg =
      last7.length > 0
        ? last7.reduce((s, e) => s + Math.max(0, (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 3_600_000), 0) / last7.length
        : null
    return { last, avg, count: sorted.length }
  }, [sleepLogs])
  const lastNightHours = sleepInfo.last
    ? Math.max(0, (new Date(sleepInfo.last.end_time).getTime() - new Date(sleepInfo.last.start_time).getTime()) / 3_600_000)
    : null

  // AI finance commentary
  const [financeNote, setFinanceNote] = useState<string | null>(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [financeFetchedAt, setFinanceFetchedAt] = useState(0)

  const fetchFinanceNote = async (force = false) => {
    if (financeLoading) return
    if (!force && financeFetchedAt && Date.now() - financeFetchedAt < 6 * 3600 * 1000) return
    setFinanceLoading(true)
    try {
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const prevKey = now.getMonth() === 0 ? `${now.getFullYear() - 1}-12` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
      // Wallet loads / rent / SIP are transfers, not real spends — exclude
      // them so the note talks about actual spending, not wallet top-ups.
      const excluded = new Set(['rent', 'sip', 'investments', 'housing', 'wallet loads', 'wallet load'])
      const spendTypes = new Set(['expense', 'fuel_purchase', 'vehicle_service'])
      const isSpend = (t: Transaction) =>
        spendTypes.has(t.type) &&
        !excluded.has(t.category.toLowerCase()) &&
        !((t.notes ?? '').toLowerCase().includes('wallet load') || (t.notes ?? '').toLowerCase().includes('payzapp'))
      const monthTxns = (txns ?? []).filter((t) => isSpend(t) && t.date.slice(0, 7) === monthKey)
      const prevTxns = (txns ?? []).filter((t) => isSpend(t) && t.date.slice(0, 7) === prevKey)
      const byCat = new Map<string, { amount: number; count: number }>()
      for (const t of monthTxns) {
        const c = byCat.get(t.category) ?? { amount: 0, count: 0 }
        c.amount += t.amount / 100
        c.count += 1
        byCat.set(t.category, c)
      }
      const categories = [...byCat.entries()]
        .map(([category, v]) => ({ category, amountRupees: Math.round(v.amount), count: v.count }))
        .sort((a, b) => b.amountRupees - a.amountRupees)
      const monthIncome = (txns ?? [])
        .filter((t) => t.type === 'income' && t.date.slice(0, 7) === monthKey)
        .reduce((s, t) => s + t.amount / 100, 0)
      const bankBalance = (accounts ?? []).reduce((s, a) => s + (a.amount ?? 0), 0) / 100
      const cardOutstanding = (cards ?? []).reduce((s, c) => s + (c.balance ?? c.current_outstanding ?? 0), 0) / 100
      const lentOut = (receivables ?? [])
        .filter((r) => r.type === 'lent' && r.status !== 'paid')
        .reduce((s, r) => s + r.amount / 100, 0)
      const { data, error } = await supabase.functions.invoke('ai-finance-comment', {
        body: {
          context: {
            monthLabel: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            totalSpendRupees: Math.round(monthTxns.reduce((s, t) => s + t.amount / 100, 0)),
            budgetRupees: null,
            topDay: null,
            biggestTx: null,
            lastMonthTotalRupees: prevTxns.length > 0 ? Math.round(prevTxns.reduce((s, t) => s + t.amount / 100, 0)) : null,
            categories: categories.slice(0, 8),
            monthIncomeRupees: Math.round(monthIncome),
            bankBalanceRupees: Math.round(bankBalance),
            cardOutstandingRupees: Math.round(cardOutstanding),
            lentOutRupees: Math.round(lentOut),
            borrowedRupees: null,
          },
        },
      })
      if (!error && data?.comment) {
        setFinanceNote(data.comment as string)
        setFinanceFetchedAt(Date.now())
      }
    } catch {
      /* keep old note */
    } finally {
      setFinanceLoading(false)
    }
  }

  useEffect(() => {
    if (txns !== undefined && txns.length >= 0) fetchFinanceNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns])

  // Principles carousel (5s auto-rotate)
  const [principleIndex, setPrincipleIndex] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => {
      setPrincipleIndex((i) => (i + 1) % PRINCIPLES.length)
    }, 5000)
    return () => window.clearInterval(t)
  }, [])
  const principle = PRINCIPLES[principleIndex]

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
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={staggerContainer(0.07)}
    >
      <SEO
        title="Meridian — Personal Life Tracker"
        description="Your whole life, one dark dashboard: daily quotes, habits, sleep, AI money notes, finance, wealth, and more."
        path="/"
      />
      {/* Daily quote + habit progress + sleep hero */}
      <motion.div variants={riseItem} className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <div className="space-y-2.5 px-5 pt-5 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9BA5FF]">
              ☀️ Today's quote
            </p>
            <p className="text-lg font-semibold leading-relaxed text-white">"{quote.text}"</p>
            <p className="text-right text-xs text-white/40">— {quote.source}</p>
          </div>
        </Card>

        <Card>
          <Link to="/habits" className="block">
            <div className="space-y-3 px-5 py-5 transition-colors hover:bg-white/2">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Habits today
                </p>
                <span className="text-[10px] text-white/30">View all →</span>
              </div>
              <p className="text-3xl font-extrabold tracking-tight text-white tnum">{habitPct}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#9BA5FF] to-[#5EE6FF]"
                  style={{ width: `${Math.max(habitPct, 3)}%` }}
                />
              </div>
              <p className="text-xs text-white/40">
                {ticked.length} of {HABITS.length} done
                {bestStreak > 0 ? ` · best streak ${bestStreak}d 🔥` : ''}
              </p>
            </div>
          </Link>
        </Card>

        <Card>
          <Link to="/sleep" className="block">
            <div className="space-y-3 px-5 py-5 transition-colors hover:bg-white/2">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Sleep
                </p>
                <span className="text-[10px] text-white/30">→</span>
              </div>
              {lastNightHours !== null ? (
                <>
                  <p className="text-3xl font-extrabold tracking-tight text-white tnum">
                    {Math.floor(lastNightHours)}h {Math.round((lastNightHours % 1) * 60)}m
                  </p>
                  <p className="text-xs text-white/40">
                    last night · {sleepInfo.count} nights
                    {sleepInfo.avg ? ` · 7-night avg ${sleepInfo.avg.toFixed(1)}h` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tracking-tight text-white/70">🌙</p>
                  <p className="text-xs text-white/40">No nights logged yet</p>
                </>
              )}
            </div>
          </Link>
        </Card>
      </motion.div>

      {/* AI finance note + stress + principles carousel */}
      <motion.div variants={riseItem} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-[#E2A45C]/20">
          <div className="space-y-3 px-5 py-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E2A45C]">
                ✨ Money note · AI
              </p>
              <button
                onClick={() => fetchFinanceNote(true)}
                className="text-white/30 hover:text-white"
                aria-label="Refresh finance note"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-white/75">
              {financeLoading && !financeNote
                ? 'Reading your spends…'
                : financeNote ?? 'Log a few transactions and AI will comment on your spending.'}
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <div className="space-y-3 px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Stress release · 2 easy techniques
            </p>
            {techniques.map((t) => (
              <div key={t.name} className="flex gap-3">
                <span className="text-xl">{t.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/45">{t.steps}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-1 border-[#59D6C7]/20 bg-gradient-to-br from-[#59D6C7]/6 to-transparent">
          <div className="flex h-full flex-col justify-between gap-4 px-5 py-5">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#59D6C7]">
                Growth principles
              </p>
              <div key={principleIndex} className="animate-[fadeIn_0.4s_ease]">
                <p className="text-sm font-bold text-white">{principle.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/55">{principle.body}</p>
              </div>
            </div>
            <div className="flex justify-center gap-1.5">
              {PRINCIPLES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === principleIndex ? 'w-5 bg-[#59D6C7]' : 'w-1.5 bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Row of stat cards */}
      <motion.div variants={riseItem} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Balance" value={totalBalance} format={paiseToRupeesCompact} />
        <StatCard
          label="Card Outstanding"
          value={totalCardOutstanding}
          format={paiseToRupeesCompact}
          change={totalCardOutstanding > 0 ? undefined : 'clear'}
        />
        <StatCard
          label="Portfolio"
          value={portfolioValue}
          format={paiseToRupeesCompact}
          color="#9BA5FF"
        />
        <StatCard
          label="Net Worth"
          value={netWorth}
          format={paiseToRupeesCompact}
          color={netWorth >= 0 ? '#59D6C7' : '#FF887D'}
        />
      </motion.div>

      {/* 3-column main grid */}
      <motion.div variants={riseItem} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                  <AnimatedNumber
                    value={monthSpend}
                    format={paiseToRupees}
                    className="mt-1 text-3xl font-bold tracking-tight text-white tnum"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white/50">Income</p>
                  <AnimatedNumber
                    value={monthIncome}
                    format={paiseToRupeesCompact}
                    className="mt-1 text-lg font-semibold text-[#59D6C7] tnum"
                  />
                </div>
              </div>
              <div className="mt-4">
                <TrendArea data={trend} height={110} color="#9BA5FF" formatter={paiseToRupeesCompact} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-white/10">
              <div className="px-5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Spent · 30d</p>
                <AnimatedNumber
                  value={spent30}
                  format={paiseToRupeesCompact}
                  className="text-sm font-semibold text-white tnum"
                />
              </div>
              <div className="border-l border-white/10 px-5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Inflow · 30d</p>
                <AnimatedNumber
                  value={income30}
                  format={paiseToRupeesCompact}
                  className="text-sm font-semibold text-[#59D6C7] tnum"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white/50">Net Worth</p>
                <AnimatedNumber
                  value={netWorth}
                  format={paiseToRupees}
                  className="mt-1 text-3xl font-bold tracking-tight tnum"
                  style={{ color: netWorth >= 0 ? '#59D6C7' : '#FF887D' }}
                />
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
      </motion.div>
    </motion.div>
  )
}