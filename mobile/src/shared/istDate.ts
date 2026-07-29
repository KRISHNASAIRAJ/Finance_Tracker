/**
 * Date utilities using device local timezone (IST for India).
 * Uses native Date getters which automatically use device timezone.
 */

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getNowTimestamp(): string {
  return new Date().toISOString();
}

export function dateStringToLocal(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

export function addDays(dateStr: string, days: number): string {
  const d = dateStringToLocal(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateString();
}

export function formatDate(dateStr: string): string {
  const d = dateStringToLocal(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateFull(dateStr: string): string {
  const d = dateStringToLocal(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(dateIso?: string): string {
  const d = dateIso ? new Date(dateIso) : new Date();
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function isValidDateString(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(dateStringToLocal(str).getTime());
}
