/**
 * Local-time parsing helpers for manual sleep entry.
 * Device-local "YYYY-MM-DD HH:MM" strings ↔ Date objects.
 */

/** "2026-09-13 07:15" (device-local) from a Date */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Date from "YYYY-MM-DD HH:MM" (device-local); null when malformed */
export function parseLocalInput(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  const hour = +m[4];
  const minute = +m[5];
  // Strict component ranges — Date() silently rolls over invalid values
  // (e.g. 2026-13-45 → 2027-02-14), which must NOT count as valid input.
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Reject month/day rollover (e.g. Feb 31 → Mar 3)
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return isNaN(d.getTime()) ? null : d;
}
