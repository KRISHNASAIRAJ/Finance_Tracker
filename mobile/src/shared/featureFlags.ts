/**
 * featureFlags — small persisted flag store. Notes v2 ships dark: the flag
 * defaults to false and only a persisted override turns it on, so the existing
 * Personal Notes screen stays the default until migration is verified.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const FLAGS_KEY = 'meridian-feature-flags';

export type FeatureFlag = 'notes_v2';

const DEFAULTS: Record<FeatureFlag, boolean> = {
  notes_v2: false,
};

let cache: Record<string, boolean> | null = null;

async function readFlags(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(FLAGS_KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache as Record<string, boolean>;
}

/** Async check — use on app start / boot paths. */
export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await readFlags();
  return flags[flag] === true;
}

/** Cached check for render paths after flags have been loaded at boot. */
export function isFeatureEnabledSync(flag: FeatureFlag): boolean {
  return cache?.[flag] === true;
}

export async function setFeatureFlag(flag: FeatureFlag, value: boolean): Promise<void> {
  const flags = await readFlags();
  flags[flag] = value;
  cache = flags;
  try {
    await AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  } catch {
    // non-fatal — flag stays on for this session
  }
}

/** Test helper — clears the in-memory cache. */
export function resetFeatureFlagCache(): void {
  cache = null;
}
