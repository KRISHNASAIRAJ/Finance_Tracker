import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useHabitLogs, useUpsertHabitLog, useSettingsContent, useSaveSettingsContent } from '../../hooks/data/usePersonal'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { HabitLog } from '../../types'
import {
  HABITS,
  effectiveHabits,
  parseHabitDefs,
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
  type HabitDef,
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
  const { data: settings } = useSettingsContent(userId)
  const saveSettings = useSaveSettingsContent(userId)

  const [viewMonth, setViewMonth] = useState(monthOf(todayKey()))
  const today = todayKey()
  const byDay = useMemo(() => logMap(logs), [logs])
  const ticked = byDay.get(today) ?? []

  // Effective (user-edited or canonical) habit set
  const habitList = useMemo(
    () => effectiveHabits(parseHabitDefs(settings?.habit_defs)),
    [settings?.habit_defs],
  )
  const hasOverrides = habitList !== HABITS

  // Edit modal state
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('')

  const monthDays = useMemo(() => {
    const n = daysInMonth(viewMonth)
    return Array.from({ length: n }, (_, i) => `${viewMonth}-${String(i + 1).padStart(2, '0')}`)
  }, [viewMonth])

  const monthAverage = useMemo(() => {
    const tracked = monthDays.filter((d) => byDay.has(d))
    if (tracked.length === 0) return 0
    return tracked.reduce((s, d) => s + dayProgress(byDay.get(d) ?? [], habitList), 0) / tracked.length
  }, [monthDays, byDay, habitList])

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

  const persistHabits = (next: HabitDef[]) => {
    saveSettings.mutate({ habitDefs: JSON.stringify(next) })
  }

  const openEdit = (idx: number) => {
    const h = habitList[idx]
    setEditIdx(idx)
    setEditLabel(h.label)
    setEditEmoji(h.emoji)
  }

  const saveEdit = () => {
    if (editIdx === null || !editLabel.trim()) return
    const next = habitList.map((h, i) =>
      i === editIdx ? { ...h, label: editLabel.trim(), emoji: editEmoji.trim() || h.emoji } : h,
    )
    persistHabits(next)
    setEditIdx(null)
  }

  const removeHabit = () => {
    if (editIdx === null) return
    const next = habitList.filter((_, i) => i !== editIdx)
    persistHabits(next)
    setEditIdx(null)
  }

  const addHabit = () => {
    if (!newLabel.trim()) return
    const base = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'habit'
    let key = base
    let n = 2
    while (habitList.some((h) => h.key === key)) key = `${base}_${n++}`
    persistHabits([...habitList, { key, label: newLabel.trim(), emoji: newEmoji.trim() || '⭐' }])
    setAddOpen(false)
    setNewLabel('')
    setNewEmoji('')
  }

  const resetHabits = () => {
    if (confirm('Reset to the original 10 habits? Your edits will be removed.')) {
      saveSettings.mutate({ habitDefs: null })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habit Tracker"
        subtitle={`${habitList.length} daily habits · tick boxes · streaks · long-press to edit`}
        action={
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <Button variant="ghost" size="sm" onClick={resetHabits} aria-label="Reset habits">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Habit
            </Button>
          </div>
        }
      />

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
                    Today · {dayPercent(ticked, habitList)}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    {ticked.length} of {habitList.length} done
                  </p>
                </div>
                <span className="font-mono text-sm text-white/45">{progressBlocks(ticked, habitList)}</span>
              </div>

              {/* progress bar */}
              <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#9BA5FF] to-[#5EE6FF] transition-all"
                  style={{ width: `${Math.max(dayProgress(ticked, habitList) * 100, 3)}%` }}
                />
              </div>

              <div className="divide-y divide-white/5">
                {habitList.map((h, idx) => {
                  const done = ticked.includes(h.key)
                  const streak = habitStreak(h.key, (k) => byDay.get(k) ?? [])
                  return (
                    <button
                      key={h.key}
                      onClick={() => toggle(h.key)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openEdit(idx)
                      }}
                      onDoubleClick={() => openEdit(idx)}
                      title="Long-press (right-click) to edit"
                      className="group flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/3"
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
                      <Pencil className="h-3 w-3 shrink-0 text-white/0 transition-colors group-hover:text-white/30" />
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
                    {habitList.map((h) => (
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

      {/* Edit habit */}
      <Modal
        open={editIdx !== null}
        onClose={() => setEditIdx(null)}
        title="Edit habit"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={removeHabit}>
              Remove
            </Button>
            <Button size="sm" onClick={saveEdit}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <Field.Input
            label="Emoji"
            value={editEmoji}
            onChange={(e) => setEditEmoji(e.target.value)}
            maxLength={4}
            className="w-20 text-center"
          />
          <Field.Input
            label="Habit name"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Add habit */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New habit"
        footer={
          <Button size="sm" onClick={addHabit} disabled={!newLabel.trim()}>
            Add
          </Button>
        }
      >
        <div className="flex gap-3">
          <Field.Input
            label="Emoji"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            maxLength={4}
            placeholder="⭐"
            className="w-20 text-center"
          />
          <Field.Input
            label="Habit name"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Stretch 10 minutes"
            autoFocus
          />
        </div>
      </Modal>
    </div>
  )
}
