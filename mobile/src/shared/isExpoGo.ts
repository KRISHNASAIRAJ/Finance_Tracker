/**
 * isExpoGo — Detects if running in Expo Go via expo-constants execution environment.
 */
let _isExpoGo: boolean | null = null;

export function isExpoGo(): boolean {
  if (_isExpoGo !== null) return _isExpoGo;
  try {
    // Dynamic require keeps this module importable in plain Node/Jest contexts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants');
    _isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
  } catch {
    _isExpoGo = false;
  }
  return _isExpoGo;
}
