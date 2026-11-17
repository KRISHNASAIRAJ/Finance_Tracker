/** The morning sleep summary text. */
import { formatSleepSummary } from '../sleepSummaryNotify';
import type { WakeUp } from '../sleepInference';

const at = (h: number, m: number) => new Date(2026, 10, 18, h, m, 0, 0).getTime();
const w = (minutes: number, startMs: number): WakeUp => ({
  startMs,
  endMs: startMs + minutes * 60000,
  minutes,
});

describe('formatSleepSummary', () => {
  it('says there were no interruptions when there were none', () => {
    expect(formatSleepSummary(440, [])).toContain('no interruptions');
    expect(formatSleepSummary(440, [])).toContain('7h 20m');
  });

  it('lists short wake-ups with their minutes and no "Long" label', () => {
    const text = formatSleepSummary(440, [w(4, at(1, 10)), w(8, at(3, 30))]);
    expect(text).toContain('2 wake-ups');
    expect(text).toContain('4 min at');
    expect(text).toContain('8 min at');
    expect(text).not.toContain('Long:');
  });

  it('highlights wake-ups over 15 minutes', () => {
    const text = formatSleepSummary(440, [w(22, at(2, 0)), w(5, at(4, 0))]);
    expect(text).toContain('Long:');
    expect(text).toContain('22 min at');
    expect(text).toContain('Others:');
    expect(text).toContain('5 min at');
  });

  it('does not add "Others" when every wake-up was long', () => {
    const text = formatSleepSummary(440, [w(22, at(2, 0)), w(18, at(4, 0))]);
    expect(text).toContain('Long:');
    expect(text).not.toContain('Others:');
  });

  it('treats exactly 15 minutes as short and 16 as long', () => {
    expect(formatSleepSummary(440, [w(15, at(2, 0))])).not.toContain('Long:');
    expect(formatSleepSummary(440, [w(16, at(2, 0))])).toContain('Long:');
  });

  it('orders wake-ups by time within the long and short groups', () => {
    // Long wake-ups are shown first (they matter most), each group in time order.
    const text = formatSleepSummary(440, [
      w(20, at(4, 0)),
      w(8, at(2, 0)),
      w(3, at(1, 0)),
    ]);
    expect(text.indexOf('Long:')).toBeLessThan(text.indexOf('Others:'));
    expect(text.indexOf('3 min at')).toBeLessThan(text.indexOf('8 min at'));
  });
});
