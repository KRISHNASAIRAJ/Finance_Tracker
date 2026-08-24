/**
 * Formatting helpers — money stored as paise (integers) everywhere, displayed in ₹.
 */

export function paiseToRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function paiseToRupeesDetailed(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function paiseToRupeesCompact(paise: number): string {
  const v = paise / 100
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function rupeesToPaise(input: string | number): number {
  const n = typeof input === 'string' ? parseFloat(input) : input
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

/** Parse a "₹1,234.56" style input back to a number. */
export function parseRupees(str: string): number {
  const cleaned = str.replace(/[₹,\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : n
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function formatNumber(n: number, maxFraction = 2): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: maxFraction })
}

/** "2026-08" month key of an ISO date. */
export function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "Aug 2026" display from month key. */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
