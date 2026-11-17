/** Pure windowed scoring from sleepScoring.ts. */
import {
  analyzeNight,
  personalCutoff,
  DEFAULT_CUTOFF,
  MIN_WAKEUP_MIN,
  type Bucket,
} from '../sleepScoring';

const BED = 30_000_000; // arbitrary epoch minute
const N = 240;

function stillNight(): Bucket[] {
  return Array.from({ length: N }, (_, i) => ({ m: BED + i, v: 0.05, s: 0 }));
}
function withAwake(night: Bucket[], from: number, to: number, moving = 60): Bucket[] {
  return night.map((b, i) => (i >= from && i <= to ? { ...b, v: 1.5, s: moving } : b));
}

describe('analyzeNight', () => {
  it('scores a fully still night as sleep with no wake-ups', () => {
    const res = analyzeNight(stillNight(), BED, BED + N - 1, 'medium');
    expect(res.sleepMinutes).toBe(N);
    expect(res.unknownMinutes).toBe(0);
    expect(res.wakeUps).toEqual([]);
    expect(res.microArousals).toBe(0);
    expect(res.cutoffUsed).toBe(DEFAULT_CUTOFF.medium);
  });

  it('counts missing minutes as unknown, never as sleep', () => {
    const night = stillNight();
    night.splice(100, 3); // three minutes with no bucket at all
    const res = analyzeNight(night, BED, BED + N - 1, 'medium');
    expect(res.unknownMinutes).toBe(3);
    expect(res.sleepMinutes).toBe(N - 3);
  });

  it('absorbs a one-minute blip as a micro-arousal', () => {
    // s=24 is above the medium cutoff at the centre minute but too weak to
    // push its neighbours over it, so the awake run is exactly one minute.
    const night = withAwake(stillNight(), 120, 120, 24);
    const res = analyzeNight(night, BED, BED + N - 1, 'medium');
    expect(res.microArousals).toBe(1);
    expect(res.wakeUps).toEqual([]);
  });

  it('keeps a screen-on minute awake even with no movement', () => {
    const night = stillNight().map((b, i) => (i === 120 ? { ...b, o: 60 } : b));
    const res = analyzeNight(night, BED, BED + N - 1, 'medium');
    // Screen-on blips are excluded from micro-arousal absorption.
    expect(res.wakeUps.length + res.microArousals).toBeGreaterThanOrEqual(1);
  });

  it('reports an awake run of at least MIN_WAKEUP_MIN as a wake-up', () => {
    const night = withAwake(stillNight(), 100, 110);
    const res = analyzeNight(night, BED, BED + N - 1, 'medium');
    expect(res.wakeUps).toHaveLength(1);
    expect(res.wakeUps[0].minutes).toBeGreaterThanOrEqual(MIN_WAKEUP_MIN);
    // The window can pull the edges a minute or two either side of the raw run.
    expect(res.wakeUps[0].startMs).toBeLessThanOrEqual((BED + 100) * 60000);
    expect(res.wakeUps[0].endMs).toBeGreaterThanOrEqual((BED + 111) * 60000);
  });

  it('uses the supplied cutoff', () => {
    const res = analyzeNight(stillNight(), BED, BED + N - 1, 'medium', 99);
    expect(res.cutoffUsed).toBe(99);
    expect(res.sleepMinutes).toBe(N);
  });
});

describe('personalCutoff', () => {
  it('uses the preset when there are fewer than ~5 hours of scores', () => {
    expect(personalCutoff([stillNight()], 'medium')).toBe(DEFAULT_CUTOFF.medium);
    expect(personalCutoff([], 'high')).toBe(DEFAULT_CUTOFF.high);
  });

  it('clamps a learned cutoff near the preset', () => {
    // Two very active nights → p85 is huge, but the result must stay within
    // 0.6x–1.6x of the preset so one odd night cannot skew the detector.
    const active = Array.from({ length: 2 }, (_, k) =>
      Array.from({ length: N }, (_, i) => ({
        m: BED + k * N + i,
        v: 3,
        s: 60,
      }))
    );
    const cut = personalCutoff(active, 'medium');
    expect(cut).toBeGreaterThanOrEqual(DEFAULT_CUTOFF.medium * 0.6);
    expect(cut).toBeLessThanOrEqual(DEFAULT_CUTOFF.medium * 1.6);
  });

  it('clamps a very quiet night to the lower bound', () => {
    const quiet = Array.from({ length: 2 }, (_, k) =>
      Array.from({ length: N }, (_, i) => ({ m: BED + k * N + i, v: 0.05, s: 0 }))
    );
    expect(personalCutoff(quiet, 'medium')).toBe(DEFAULT_CUTOFF.medium * 0.6);
  });
});
