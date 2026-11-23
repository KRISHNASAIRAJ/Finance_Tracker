/**
 * Local id helpers. No new dependency: ids are RFC-4122-shaped v4 strings
 * generated from Math.random (crypto is not available in the Jest environment
 * and this data is not security sensitive).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'meridian-device-id';
let cachedDeviceId: string | null = null;

export function newId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[(Math.random() * 4 + 8) | 0];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}

/** Stable per-install device id, persisted so conflict copies survive restarts. */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      cachedDeviceId = stored;
      return stored;
    }
  } catch {
    // fall through to a fresh id
  }
  cachedDeviceId = newId();
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, cachedDeviceId);
  } catch {
    // non-fatal
  }
  return cachedDeviceId;
}

/** Synchronous variant for pure functions that receive the id explicitly. */
export function setCachedDeviceId(id: string): void {
  cachedDeviceId = id;
}
