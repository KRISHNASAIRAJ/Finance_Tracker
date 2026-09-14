/**
 * habits — web mirror of the mobile habit definitions and day/streak helpers.
 * Keep in sync with mobile/src/modules/habits/habits.ts.
 */

export interface HabitDef {
  key: string
  label: string
  emoji: string
}

export const HABITS: HabitDef[] = [
  { key: 'sleep_6_7', label: 'Sleep 6–7 hours', emoji: '💤' },
  { key: 'cook_meals', label: 'Cook meals for the day', emoji: '🥗' },
  { key: 'eat_fruit', label: 'Eat a fruit', emoji: '🍎' },
  { key: 'no_junk', label: 'No junk food', emoji: '🚫' },
  { key: 'water_3l', label: 'Drink 3L water', emoji: '💧' },
  { key: 'sleep_by_11', label: 'Sleep by 11 PM', emoji: '🌙' },
  { key: 'chia_seeds', label: 'Take chia / tukmaria seeds', emoji: '🌱' },
  { key: 'learn_topic', label: 'Learn 1 topic (skillset)', emoji: '📚' },
  { key: 'read_or_watch', label: 'Read 1 page / watch useful video', emoji: '📖' },
  { key: 'plan_tomorrow', label: "Plan tomorrow's tasks", emoji: '🗒️' },
]

export const HABIT_KEYS: string[] = HABITS.map((h) => h.key)

/** IST calendar day key (YYYY-MM-DD) — pure UTC math, works from any TZ. */
export function istDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Date(date.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10)
}

export function todayKey(): string {
  return istDayKey(new Date())
}

export function parseHabits(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((k) => typeof k === 'string')
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function dayProgress(ticked: string[]): number {
  if (HABITS.length === 0) return 0
  const valid = ticked.filter((k) => HABIT_KEYS.includes(k))
  return Math.min(1, valid.length / HABITS.length)
}

export function dayPercent(ticked: string[]): string {
  return `${Math.round(dayProgress(ticked) * 100)}%`
}

export function progressBlocks(ticked: string[]): string {
  const filled = Math.round(dayProgress(ticked) * 10)
  return '⬛'.repeat(filled) + '⬜'.repeat(10 - filled) + ` ${Math.round(dayProgress(ticked) * 100)}%`
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

export function monthOf(dayKey: string): string {
  return dayKey.slice(0, 7)
}

export function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function habitStreak(habitKey: string, logsByDay: (dayKey: string) => string[]): number {
  let streak = 0
  const day = new Date()
  if (!logsByDay(istDayKey(day)).includes(habitKey)) {
    day.setDate(day.getDate() - 1)
  }
  for (let guard = 0; guard < 365; guard++) {
    if (logsByDay(istDayKey(day)).includes(habitKey)) {
      streak += 1
      day.setDate(day.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
