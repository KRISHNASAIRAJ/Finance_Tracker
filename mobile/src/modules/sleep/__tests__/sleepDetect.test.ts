/**
 * Unit tests for sleepDetect wrapper — graceful degradation.
 * The wrapper must NEVER throw, regardless of native-module availability.
 */

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'test' },
}));

import { isSleepDetectAvailable, detectLastSleep, hasUsageAccess } from '../sleepDetect';

describe('sleepDetect — graceful degradation', () => {
  it('reports unavailable when native module is missing (non-Android / Expo Go)', () => {
    expect(isSleepDetectAvailable()).toBe(false);
  });

  it('hasUsageAccess resolves false — never throws — when unavailable', async () => {
    await expect(hasUsageAccess()).resolves.toBe(false);
  });

  it('detectLastSleep resolves null — never throws — when unavailable', async () => {
    await expect(detectLastSleep()).resolves.toBeNull();
    await expect(detectLastSleep(2)).resolves.toBeNull();
  });
});
