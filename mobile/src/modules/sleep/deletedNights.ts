/**
 * deletedNights — a local tombstone list of nights the user deleted.
 *
 * The motion tracker keeps recording after an entry is deleted, so the
 * auto-save / hourly live-backup / cloud-pull paths used to resurrect the
 * night on the next app open. When the user deletes a sleep entry we store
 * that night's local day key here; every automatic writer checks it before
 * re-creating or updating the night.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey } from '../finance/financeFormat';

const KEY = 'meridian-sleep-deleted-nights';
/** Cap the list so it never grows unbounded (oldest first out). */
const MAX_KEYS = 90;

/** The local day key of a night (its bedtime's calendar day). */
export function nightDayKeyOf(startTime: string | number): string {
  return localDayKey(new Date(startTime));
}

async function readKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember that the user deleted the night (idempotent). */
export async function tombstoneDeletedNight(dayKey: string): Promise<void> {
  try {
    const keys = await readKeys();
    if (keys.includes(dayKey)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([...keys, dayKey].slice(-MAX_KEYS)));
  } catch {
    /* best-effort — never block the delete itself */
  }
}

/**
 * Tombstone BOTH local days of the night in one read-modify-write —
 * never as two independent writes, or one clobbers the other.
 */
export async function tombstoneDeletedNightRange(
  startTime: string | number | Date,
  endTime?: string | number | Date | null,
): Promise<void> {
  try {
    const keys = await readKeys();
    const add = new Set(keys);
    const a = localDayKey(new Date(startTime));
    add.add(a);
    if (endTime != null) {
      const b = localDayKey(new Date(endTime));
      if (b !== a) add.add(b);
    }
    if (add.size === keys.length) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([...add].slice(-MAX_KEYS)));
  } catch {
    /* best-effort — never block the delete itself */
  }
}

/** True when the user deleted this night and nothing automatic may re-create it. */
export async function isSleepNightDeleted(dayKey: string): Promise<boolean> {
  return (await readKeys()).includes(dayKey);
}

/**
 * True when either local day the night touches was tombstoned.
 *
 * A night can straddle midnight, and different writers can key the same
 * night by its start day or its end day — check both.
 */
export async function isSleepNightRangeDeleted(
  startTime: string | number,
  endTime?: string | number | null,
): Promise<boolean> {
  const a = localDayKey(new Date(startTime));
  if (await isSleepNightDeleted(a)) return true;
  if (endTime != null) {
    const b = localDayKey(new Date(endTime));
    if (b !== a && (await isSleepNightDeleted(b))) return true;
  }
  return false;
}
