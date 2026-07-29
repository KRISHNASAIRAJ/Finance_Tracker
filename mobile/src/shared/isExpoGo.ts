let _isExpoGo: boolean | null = null;

export function isExpoGo(): boolean {
  if (_isExpoGo !== null) return _isExpoGo;
  try {
    const Constants = require('expo-constants');
    _isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
  } catch {
    _isExpoGo = false;
  }
  return _isExpoGo;
}
