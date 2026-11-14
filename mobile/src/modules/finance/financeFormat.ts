/**
 * financeFormat — the ₹ helpers both new Meridian v2 insight screens use.
 * Pure, no imports — safe for Jest.
 */

/** ₹1,23,456 — whole rupees, Indian grouping. */
export function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/** ₹12.3k / ₹1.2L / ₹1.2Cr — compact, or whole rupees under ₹1,000. */
export function formatCompact(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

/** Local YYYY-MM-DD day key (device local time — IST on the user's phone). */
export function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Normalize a stored date/ISO string to a local day key. Date-only inputs
 * are already day keys and are taken verbatim (never timezone-shifted). */
export function asDayKey(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return localDayKey(d);
}

/** Shift a local YYYY-MM-DD day key by n days. */
export function shiftLocalDayKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return localDayKey(dt);
}

/** All local day keys from `fromKey` to `toKey`, inclusive. */
export function dayKeyRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cursor = fromKey;
  // Bounded loop — a forecast never exceeds a few months.
  for (let i = 0; i < 370; i += 1) {
    out.push(cursor);
    if (cursor >= toKey) break;
    cursor = shiftLocalDayKey(cursor, 1);
  }
  return out;
}

/** "2026-11-30" → "30 Nov". */
export function shortDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "2026-11-30" → "NOV" for the date-chip rows. */
export function monthOfKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
}

/** "2026-11-30" → day of month number ("30"). */
export function dayOfKey(key: string): number {
  return Number(key.split('-')[2]);
}
