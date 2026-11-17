/**
 * tune-sleep-scoring — run the new scoring algorithm on REAL saved nights.
 *
 * The raw motion buckets live only on the Android device (SharedPreferences),
 * not in Supabase. Export them to a JSON file, then run:
 *
 *   node scripts/tune-sleep-scoring.js <path-to-export.json>
 *
 * Expected JSON (either shape):
 *   [ [bucket, ...], [bucket, ...] ]             // array of nights
 *   { "nights": [ [bucket, ...], ... ] }          // or wrapped
 *
 * A bucket is { "m": <epoch minute>, "v": <peak m/s^2>, "s"?: <moving seconds>,
 * "o"?: <screen-on seconds> } — exactly what SleepMotionModule.getBuckets()
 * returns. Nights may be in any order; the newest 7 are used for the personal
 * cutoff, matching the app.
 *
 * The script transpiles mobile/src/modules/sleep/sleepScoring.ts with the
 * project's own TypeScript compiler, so there is one source of truth.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TS = require(path.join(ROOT, 'mobile', 'node_modules', 'typescript'));
const SOURCE = path.join(
  ROOT,
  'mobile',
  'src',
  'modules',
  'sleep',
  'sleepScoring.ts'
);

function loadScoring() {
  const src = fs.readFileSync(SOURCE, 'utf8');
  const js = TS.transpileModule(src, {
    compilerOptions: {
      module: TS.ModuleKind.CommonJS,
      target: TS.ScriptTarget.ES2019,
    },
  }).outputText;
  const module = { exports: {} };
  // The scoring module is pure and has no imports — a bare Function is enough.
  new Function('exports', 'module', 'require', js)(module.exports, module, require);
  return module.exports;
}

function readNights(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Accept: app export { nights: [...] }, a plain array of nights, or the
  // output of `supabase db query --remote --read-only select ... from
  // sleep_motion_nights` (rows with a `buckets` JSONB column).
  let nights;
  if (Array.isArray(raw)) {
    nights = raw.length > 0 && Array.isArray(raw[0]) ? raw : raw.map((r) => r.buckets);
  } else if (Array.isArray(raw.nights)) {
    nights = raw.nights;
  } else if (Array.isArray(raw.rows)) {
    nights = raw.rows.map((r) => r.buckets);
  }
  if (!Array.isArray(nights) || nights.length === 0) {
    throw new Error('No nights found in the export file');
  }
  return nights.map((night, i) => {
    if (!Array.isArray(night)) throw new Error(`Night ${i} is not an array`);
    return night.filter((b) => b && Number.isFinite(b.m) && b.m > 0);
  });
}

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/tune-sleep-scoring.js <export.json>');
    process.exit(1);
  }
  const { analyzeNight, personalCutoff, DEFAULT_CUTOFF } = loadScoring();
  const nights = readNights(file);

  // The app processes nights newest-first by epoch minute; mirror that here.
  const ordered = [...nights].sort(
    (a, b) => Math.max(...b.map((x) => x.m)) - Math.max(...a.map((x) => x.m))
  );
  const cutoff = personalCutoff(ordered.slice(0, 7), 'medium');
  console.log(`nights: ${ordered.length}   personal cutoff: ${cutoff.toFixed(2)} s`);
  console.log(`preset medium: ${DEFAULT_CUTOFF.medium} s`);
  console.log('');

  let totalWakeUps = 0;
  let totalMicro = 0;
  for (let i = 0; i < ordered.length; i++) {
    const night = ordered[i];
    const bedMin = Math.min(...night.map((b) => b.m));
    const wakeMin = Math.max(...night.map((b) => b.m));
    const res = analyzeNight(night, bedMin, wakeMin, 'medium', cutoff);
    totalWakeUps += res.wakeUps.length;
    totalMicro += res.microArousals;
    const label = new Date(wakeMin * 60000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
    const wakes = res.wakeUps
      .map(
        (w) =>
          `${new Date(w.startMs).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}:${w.minutes}m`
      )
      .join(', ');
    console.log(
      `${label}  clock=${fmtMinutes(wakeMin - bedMin + 1)}  ` +
        `scored=${fmtMinutes(res.sleepMinutes)}  unknown=${res.unknownMinutes}m  ` +
        `wakeUps=${res.wakeUps.length}  micro=${res.microArousals}` +
        (wakes ? `  [${wakes}]` : '')
    );
  }
  console.log('');
  console.log(
    `average: ${(totalWakeUps / ordered.length).toFixed(1)} wake-ups, ` +
      `${(totalMicro / ordered.length).toFixed(1)} micro-arousals per night`
  );
}

try {
  main();
} catch (e) {
  console.error(`tune-sleep-scoring: ${e.message}`);
  process.exit(1);
}
