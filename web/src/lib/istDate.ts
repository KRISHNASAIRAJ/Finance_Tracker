/**
 * IST date helpers — display dates in Asia/Kolkata, store UTC/ISO.
 */

const IST_TZ = 'Asia/Kolkata'

export function istNow(): Date {
  return new Date()
}

export function istDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST_TZ })
}

export function istMonthKey(d: Date = new Date()): string {
  const parts = d
    .toLocaleDateString('en-CA', { timeZone: IST_TZ })
    .split('-')
  return `${parts[0]}-${parts[1]}`
}

export function istDayOfMonth(d: Date = new Date()): number {
  return Number(d.toLocaleDateString('en-CA', { timeZone: IST_TZ }).split('-')[2])
}

export function istWeekNumber(d: Date = new Date()): number {
  const copy = new Date(d)
  copy.setHours(12, 0, 0, 0)
  const day = copy.getDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(copy)
  monday.setDate(copy.getDate() - diffToMonday)
  const yearStart = new Date(monday.getFullYear(), 0, 1)
  const week = Math.ceil(((monday.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7)
  return week
}

export function istWeekYear(d: Date = new Date()): number {
  return Number(d.toLocaleDateString('en-CA', { timeZone: IST_TZ }).split('-')[0])
}

export function toInputDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: IST_TZ })
}

export function fromInputDate(value: string): string {
  if (!value) return new Date().toISOString()
  const [y, m, day] = value.split('-').map(Number)
  return new Date(y, m - 1, day, 12, 0, 0).toISOString()
}
