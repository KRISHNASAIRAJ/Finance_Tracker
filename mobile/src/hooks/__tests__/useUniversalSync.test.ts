/**
 * useUniversalSync — cloud hydration for the tables without a module hook.
 */
import { pull } from '../useUniversalSync';
import { useDiaryStore } from '../../modules/diary/store';
import { useCareerStore } from '../../modules/career/store';

const rows: Record<string, unknown[]> = {
  weekly_diary: [
    { id: 'd1', week_year: 2026, week_number: 44, content: 'A good week', updated_at: '2026-11-01T00:00:00Z' },
  ],
  career_events: [
    { id: 'c1', name: 'Promotion', date: '2026-10-01', type: 'up', notes: 'Great news' },
  ],
};

jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: rows[table] ?? [], error: null }),
      }),
    }),
  },
}));

jest.mock('../../services/syncQueue', () => ({
  processSyncQueue: jest.fn(async () => {}),
  getPendingEntityIds: jest.fn(async () => new Set<string>()),
  enqueue: jest.fn(async () => {}),
}));

beforeEach(() => {
  useDiaryStore.setState({ entries: [] });
  useCareerStore.setState({ events: [] });
});

describe('universal sync pull', () => {
  it('hydrates weekly diary rows', async () => {
    await pull('user-1');
    const entries = useDiaryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'd1', weekYear: 2026, weekNumber: 44, content: 'A good week',
    });
  });

  it('hydrates career events', async () => {
    await pull('user-1');
    const events = useCareerStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'c1', name: 'Promotion', type: 'up' });
  });

  it('keeps a local row that is not in the cloud', async () => {
    useCareerStore.setState({
      events: [{ id: 'local-1', name: 'Local', date: '2026-11-10', type: 'balance', notes: '' }],
    });
    await pull('user-1');
    const ids = useCareerStore.getState().events.map((e) => e.id);
    expect(ids).toContain('local-1');
    expect(ids).toContain('c1');
  });
});
