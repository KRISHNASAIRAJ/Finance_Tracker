/**
 * ServiceIssuesStore — the next-service issue list.
 */
import { useServiceIssuesStore, openIssuesFor } from '../serviceIssuesStore';

jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
}));

beforeEach(() => {
  useServiceIssuesStore.setState({ issues: [] });
});

describe('service issues', () => {
  it('adds an issue as open with a timestamp', () => {
    const id = useServiceIssuesStore.getState().addIssue(
      { vehicle: 'Bike', title: 'Squeaky brake', notes: 'Front', severity: 'high', odometerKm: 4200 },
      'user-1'
    );
    const issue = useServiceIssuesStore.getState().issues.find((i) => i.id === id)!;
    expect(issue).toMatchObject({
      vehicle: 'Bike', title: 'Squeaky brake', status: 'open', severity: 'high', odometerKm: 4200,
    });
    expect(issue.createdAt).toBeTruthy();
  });

  it('filters open issues by vehicle', () => {
    const s = useServiceIssuesStore.getState();
    s.addIssue({ vehicle: 'Bike', title: 'A', notes: '', severity: 'low', odometerKm: null });
    s.addIssue({ vehicle: 'Car', title: 'B', notes: '', severity: 'low', odometerKm: null });
    expect(openIssuesFor(useServiceIssuesStore.getState().issues, 'Bike').map((i) => i.title)).toEqual(['A']);
  });

  it('marks an issue fixed and reopens it', () => {
    const id = useServiceIssuesStore.getState().addIssue(
      { vehicle: 'Bike', title: 'A', notes: '', severity: 'medium', odometerKm: null }
    );
    useServiceIssuesStore.getState().toggleFixed(id);
    expect(useServiceIssuesStore.getState().issues[0].status).toBe('fixed');
    expect(useServiceIssuesStore.getState().issues[0].fixedAt).toBeTruthy();
    useServiceIssuesStore.getState().toggleFixed(id);
    expect(useServiceIssuesStore.getState().issues[0].status).toBe('open');
    expect(useServiceIssuesStore.getState().issues[0].fixedAt).toBeNull();
  });

  it('deletes an issue', () => {
    const id = useServiceIssuesStore.getState().addIssue(
      { vehicle: 'Bike', title: 'A', notes: '', severity: 'medium', odometerKm: null }
    );
    useServiceIssuesStore.getState().deleteIssue(id);
    expect(useServiceIssuesStore.getState().issues).toHaveLength(0);
  });
});
