import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isFeatureEnabled, isFeatureEnabledSync, resetFeatureFlagCache, setFeatureFlag,
} from '../featureFlags';

beforeEach(async () => {
  resetFeatureFlagCache();
  await AsyncStorage.clear();
});

describe('notes_v2 feature flag', () => {
  it('is off by default so the old Personal Notes screen stays active', async () => {
    expect(await isFeatureEnabled('notes_v2')).toBe(false);
  });

  it('persists an override and exposes it to sync render paths', async () => {
    await setFeatureFlag('notes_v2', true);
    expect(await isFeatureEnabled('notes_v2')).toBe(true);
    expect(isFeatureEnabledSync('notes_v2')).toBe(true);

    resetFeatureFlagCache();
    expect(isFeatureEnabledSync('notes_v2')).toBe(false);
    expect(await isFeatureEnabled('notes_v2')).toBe(true);
  });

  it('can be turned back off for rollback', async () => {
    await setFeatureFlag('notes_v2', true);
    await setFeatureFlag('notes_v2', false);
    expect(await isFeatureEnabled('notes_v2')).toBe(false);
  });
});
