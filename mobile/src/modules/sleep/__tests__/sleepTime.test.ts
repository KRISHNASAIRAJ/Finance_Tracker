/**
 * Unit tests for sleep time-input parsing used by the dashboard's
 * manual log form (local-time "YYYY-MM-DD HH:MM" handling).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// The parse/format helpers live inside the screen file; re-testing the
// exact logic here guards against regressions (regex + local-time math).
// We import from the screen module via its exported test path.
import { parseLocalInput, toLocalInput } from '../screens/sleepTime';

describe('Sleep manual-entry time parsing', () => {
  it('parses "YYYY-MM-DD HH:MM" into a valid local Date', () => {
    const d = parseLocalInput('2026-09-12 23:30');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8); // September
    expect(d!.getDate()).toBe(12);
    expect(d!.getHours()).toBe(23);
    expect(d!.getMinutes()).toBe(30);
  });

  it('rejects malformed strings with null (no NaN dates)', () => {
    expect(parseLocalInput('23:30')).toBeNull();
    expect(parseLocalInput('2026-09-12')).toBeNull();
    expect(parseLocalInput('12/09/2026 23:30')).toBeNull();
    expect(parseLocalInput('2026-13-45 23:30')).toBeNull();
    expect(parseLocalInput('')).toBeNull();
    expect(parseLocalInput(undefined as unknown as string)).toBeNull();
  });

  it('round-trips a Date through toLocalInput → parseLocalInput', () => {
    const d = new Date(2026, 8, 13, 7, 15);
    const s = toLocalInput(d);
    expect(s).toBe('2026-09-13 07:15');
    const back = parseLocalInput(s)!;
    expect(back.getTime()).toBe(d.getTime());
  });
});
