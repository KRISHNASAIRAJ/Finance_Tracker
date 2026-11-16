import { describe, expect, it } from 'vitest'
import { dedupeById, recurringInstanceId } from '../taskSync'

describe('dedupeById', () => {
  it('removes repeated rows with the same id and keeps first-seen order', () => {
    const rows = [
      { id: 'a', title: 'first' },
      { id: 'b', title: 'second' },
      { id: 'a', title: 'stale echo of first' },
      { id: 'c', title: 'third' },
    ]
    expect(dedupeById(rows)).toEqual([
      { id: 'a', title: 'first' },
      { id: 'b', title: 'second' },
      { id: 'c', title: 'third' },
    ])
  })

  it('returns a unique list even when every row is duplicated', () => {
    const rows = [{ id: 'x' }, { id: 'x' }, { id: 'x' }]
    expect(dedupeById(rows)).toEqual([{ id: 'x' }])
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 'x' }, { id: 'x' }]
    dedupeById(rows)
    expect(rows).toHaveLength(2)
  })
})

describe('recurringInstanceId', () => {
  it('is stable for the same source task and due date (idempotent upsert)', () => {
    const sourceId = 'task-123'
    const due = '2026-11-17T09:00:00.000Z'
    expect(recurringInstanceId(sourceId, due)).toBe(recurringInstanceId(sourceId, due))
    expect(recurringInstanceId(sourceId, due)).toBe('rec_task-123_2026-11-17')
  })

  it('changes for a different due date or source task', () => {
    expect(recurringInstanceId('task-123', '2026-11-17T09:00:00Z')).not.toBe(
      recurringInstanceId('task-123', '2026-11-18T09:00:00Z')
    )
    expect(recurringInstanceId('task-123', '2026-11-17T09:00:00Z')).not.toBe(
      recurringInstanceId('task-999', '2026-11-17T09:00:00Z')
    )
  })
})
