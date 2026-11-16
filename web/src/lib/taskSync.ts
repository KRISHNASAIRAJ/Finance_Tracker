/**
 * Pure helpers for task sync correctness. Kept dependency-free so they can be
 * unit-tested in isolation from Supabase / React Query.
 */

/** Collapse rows keyed by primary id, preserving first-seen order.
 *
 * Realtime echoes and retried inserts can surface the same row twice in a
 * refetch. Without this, a duplicate row renders as a duplicate task. */
export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>()
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return Array.from(byId.values())
}

/**
 * Stable id for the next occurrence of a recurring task.
 *
 * A random id meant double-clicking "complete" before realtime refetch created
 * multiple next instances of the same recurring task. Upserting against this
 * deterministic id makes the operation idempotent: repeat toggles update the
 * same next row instead of inserting duplicates.
 */
export function recurringInstanceId(sourceId: string, nextDue: string): string {
  return `rec_${sourceId}_${nextDue.slice(0, 10)}`
}
