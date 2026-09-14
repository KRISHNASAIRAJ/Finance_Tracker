import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useHabitLogs, useUpsertHabitLog } from '../../hooks/data/usePersonal'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import type { HabitLog } from '../../types'
import {
  HABITS,
  todayKey,
  parseHabits,
  dayProgress,
  dayPercent,
  progressBlocks,
  daysInMonth,
  monthOf,
  shiftMonth,
  monthLabel,
  habitStreak,
} from '../../lib/habits'

function logMap(logs: HabitLog[] | undefined): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const l of logs ?? []) m.set(l.log_date, parseHabits(l.habits))
  return m
}

export function HabitsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: logs, isLoading } = useHabitLogs(userId)
  const upsert = useUpsertHabitLog(userId)

  const [viewMonth, setViewMonth] = useState(monthOf(todayKey()))
  const today = todayKey()
  const byDay = useMemo(() => logMap(logs), [logs])
  const ticked = byDay.get(today) ?? []

  const monthDays = useMemo(() => {
    const n = daysInMonth(viewMonth)
    return Array.from({ length: n }, (_, i) => `${viewMonth}-${String(i + 1).padStart(2, '0')}`)
  }, [viewMonth])

  const monthAverage = useMemo(() => {
    const tracked = monthDays.filter((d) => byDay.has(d))
    if (tracked.length === 0) return 0
    return tracked.reduce((s, d) => s + dayProgress(byDay.get(d) ?? []), 0) / tracked.length
  }, [monthDays, byDay])

  const isCurrentMonth = viewMonth === monthOf(today)

  const toggle = (habitKey: string) => {
    const has = ticked.includes(habitKey)
    const next = has ? ticked.filter((k) => k !== habitKey) : [...ticked, habitKey]
    const existing = (logs ?? []).find((l) => l.log_date === today)
    upsert.mutate({
      id: existing?.id,
      row: {
        log_date: today,
        habits: JSON.stringify(next),
        notes: existing?.notes ?? '',
        updated_at: new Date().toISOString(),
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Habit Tracker" subtitle="10 daily habits · tick boxes · streaks · monthly overview" />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* Today card */}
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                    Today · {dayPercent(ticked)}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    {ticked.length} of {HABITS.length} done
                  </p>
                </div>
                <span className="font-mono text-sm text-white/45">{progressBlocks(ticked)}</span>
              </div>

              {/* progress bar */}
              <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#9BA5FF] to-[#5EE6FF] transition-all"
                  style={{ width: `${Math.max(dayProgress(ticked) * 100, 3)}%` }}
                />
              </div>

              <div className="divide-y divide-white/5">
                {HABITS.map((h) => {
                  const done = ticked.includes(h.key)
                  const streak = habitStreak(h.key, (k) => byDay.get(k) ?? [])
                  return (
                    <button
                      key={h.key}
                      onClick={() => toggle(h.key)}
                      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/3"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                          done
                            ? 'border-[#4FDBCC] bg-[#4FDBCC] text-[#0A0A10]'
                            : 'border-white/25 bg-white/4'
                        }`}
                      >
                        {done && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-base">{h.emoji}</span>
                      <span className={`flex-1 text-sm ${done ? 'text-white/35 line-through' : 'text-white/85'}`}>
                        {h.label}
                      </span>
                      {streak >= 3 && (
                        <span className="flex items-center gap-1 rounded-full bg-[#FF887D]/15 px-2 py-0.5 text-[11px] font-semibold text-[#FF887D]">
                          <Flame className="h-3 w-3" /> {streak}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          {/* Monthly overview */}
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{monthLabel(viewMonth)}</p>
                  <p className="text-xs text-white/40">Monthly average {Math.round(monthAverage * 100)}%</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = shiftMonth(viewMonth, 1)
                    if (next <= monthOf(today)) setViewMonth(next)
                  }}
                  disabled={isCurrentMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="font-mono text-xs text-white/40">
                {'⬛'.repeat(Math.round(monthAverage * 10))}
                {'⬜'.repeat(10 - Math.round(monthAverage * 10))} {Math.round(monthAverage * 100)}%
              </p>

              <div className="overflow-x-auto pb-1">
                <table className="border-separate border-spacing-[3px]">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      {monthDays.map((d, i) => (
                        <th
                          key={d}
                          className={`w-6 text-[9px] font-semibold ${
                            d === today ? 'text-[#5EE6FF]' : 'text-white/30'
                          }`}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HABITS.map((h) => (
                      <tr key={h.key}>
                        <td className="w-8 text-center text-sm">{h.emoji}</td>
                        {monthDays.map((d) => {
                          const done = (byDay.get(d) ?? []).includes(h.key)
                          return (
                            <td key={d}>
                              <div
                                className={`h-4 w-4 rounded-[5px] border ${
                                  done
                                    ? 'border-[#4FDBCC]/60 bg-[#4FDBCC]/35'
                                    : 'border-white/7 bg-white/5'
                                } ${d === today ? 'ring-1 ring-[#5EE6FF]/50' : ''}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
