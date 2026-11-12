/**
 * cardBill — the credit card billing cycle helpers (shared by the pages).
 *
 * The due-date roll lives here so the web and the mobile app agree: paying a
 * bill moves the due date to the next occurrence of the billing day.
 */

/**
 * The next due date of a card: the next occurrence of the billing day that is
 * strictly after today. A billing day of 31 is clamped to the last day of a
 * short month (31 Jan → 28 Feb, never 3 March).
 */
export function nextCardDueDate(billingDay: number, now: Date = new Date()): Date {
  const day = Math.min(Math.max(Math.round(billingDay) || 1, 1), 31)
  const candidate = (year: number, month: number): Date => {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    const due = new Date(year, month, Math.min(day, lastDayOfMonth))
    due.setHours(0, 0, 0, 0)
    return due
  }
  let year = now.getFullYear()
  let month = now.getMonth()
  let due = candidate(year, month)
  if (due.getTime() <= now.getTime()) {
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
    due = candidate(year, month)
  }
  return due
}
