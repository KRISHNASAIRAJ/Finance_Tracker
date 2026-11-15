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

/** True when the user deleted this night and nothing automatic may re-create it. */
export async function isSleepNightDeleted(dayKey: string): Promise<boolean> {
  return (await readKeys()).includes(dayKey);
}
