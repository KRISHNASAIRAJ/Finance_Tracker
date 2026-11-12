/**
 * peopleStore — the "keep in touch" list.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
}));

jest.mock('../../../services/notificationService', () => ({
  schedulePeopleDigest: jest.fn(async () => {}),
}));

import { usePeopleStore } from '../store';
import { daysUntilDue } from '../peopleCadence';

describe('peopleStore', () => {
  beforeEach(() => {
    usePeopleStore.setState({ people: [] });
  });

  it('adds a person who is due after one full interval', () => {
    const id = usePeopleStore.getState().addPerson({ name: 'Ramesh', cadence: 'weekly' });
    const person = usePeopleStore.getState().people.find((p) => p.id === id);
    expect(person).toBeTruthy();
    expect(person!.name).toBe('Ramesh');
    // Never contacted → due in 7 days, not today.
    expect(daysUntilDue(person!.nextDueAt)).toBe(7);
    expect(usePeopleStore.getState().getDue().length).toBe(0);
  });

  it('marks a contact and moves the next due date one interval forward', () => {
    const id = usePeopleStore.getState().addPerson({ name: 'Priya', cadence: 'weekly' });
    usePeopleStore.getState().markContacted(id);
    const person = usePeopleStore.getState().people.find((p) => p.id === id)!;
    expect(person.lastContactedAt).toBeTruthy();
    expect(daysUntilDue(person.nextDueAt)).toBe(7);
  });

  it('lists the people who are due now', () => {
    const id = usePeopleStore.getState().addPerson({ name: 'Amit', cadence: 'weekly' });
    // Due yesterday → overdue → due now.
    usePeopleStore.setState((s) => ({
      people: s.people.map((p) =>
        p.id === id
          ? { ...p, nextDueAt: new Date(Date.now() - 86400000).toISOString() }
          : p
      ),
    }));
    const due = usePeopleStore.getState().getDue();
    expect(due.length).toBe(1);
    expect(due[0].name).toBe('Amit');
    expect(usePeopleStore.getState().dueCount()).toBe(1);
  });

  it('splits the list into due, upcoming and later', () => {
    const a = usePeopleStore.getState().addPerson({ name: 'Due now', cadence: 'weekly' });
    const b = usePeopleStore.getState().addPerson({ name: 'Soon', cadence: 'weekly' });
    const c = usePeopleStore.getState().addPerson({ name: 'Much later', cadence: 'monthly' });
    const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
    usePeopleStore.setState((s) => ({
      people: s.people.map((p) => {
        if (p.id === a) return { ...p, nextDueAt: inDays(-1) };
        if (p.id === b) return { ...p, nextDueAt: inDays(3) };
        if (p.id === c) return { ...p, nextDueAt: inDays(60) };
        return p;
      }),
    }));
    expect(usePeopleStore.getState().getDue().map((p) => p.name)).toEqual(['Due now']);
    expect(usePeopleStore.getState().getUpcoming(30).map((p) => p.name)).toEqual(['Soon']);
    expect(usePeopleStore.getState().getLater().map((p) => p.name)).toEqual(['Much later']);
  });

  it('deletes a person', () => {
    const id = usePeopleStore.getState().addPerson({ name: 'Gone', cadence: 'monthly' });
    usePeopleStore.getState().deletePerson(id);
    expect(usePeopleStore.getState().people.length).toBe(0);
  });

  it('keeps the due date in step when the cadence changes', () => {
    const id = usePeopleStore.getState().addPerson({ name: 'Switch', cadence: 'weekly' });
    usePeopleStore.getState().updatePerson(id, { cadence: 'days_45' });
    const person = usePeopleStore.getState().people.find((p) => p.id === id)!;
    expect(person.cadence).toBe('days_45');
    expect(daysUntilDue(person.nextDueAt)).toBe(45);
  });
});
