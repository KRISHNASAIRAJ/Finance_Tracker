/**
 * dietNotifications — Meal reminder scheduling with per-day tracking via AsyncStorage.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpoGo } from '../shared/isExpoGo';
// Shared slot table (breakfast 9:00 / lunch 14:15 / snack 18:30 / dinner 20:30).
// notificationService owns it — do NOT duplicate here.
import { MEAL_SLOTS } from './notificationService';
import { useMealStore } from '../modules/meals/store';

const REMINDED_KEY = 'meridian-meal-reminded';
let remindedCache: Record<string, boolean | string> | null = null;

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function loadRemindedCache(): Promise<Record<string, boolean | string>> {
  if (remindedCache) return remindedCache;
  try {
    const raw = await AsyncStorage.getItem(REMINDED_KEY);
    const parsed: Record<string, boolean | string> = raw ? JSON.parse(raw) : {};
    const today = getTodayKey();
    if (!parsed._today || parsed._today !== today) {
      remindedCache = { _today: today };
    } else {
      remindedCache = parsed;
    }
    return remindedCache;
  } catch {
    remindedCache = { _today: getTodayKey() };
    return remindedCache;
  }
}

async function saveRemindedCache(cache: Record<string, boolean | string>): Promise<void> {
  remindedCache = cache;
  try {
    await AsyncStorage.setItem(REMINDED_KEY, JSON.stringify(cache));
  } catch {
    // Non-fatal — reminder cache kept in memory for this session
  }
}

export async function resetDailyReminders(): Promise<void> {
  remindedCache = { _today: getTodayKey() };
  await AsyncStorage.setItem(REMINDED_KEY, JSON.stringify(remindedCache));
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('diet-reminders', {
        name: 'Diet Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    return true;
  } catch {
    return false;
  }
}

export async function scheduleMealReminders(): Promise<void> {
  if (isExpoGo()) return;
  // Delegate to the single unified scheduler (force=true: this is only
  // called on explicit toggle changes / boot paths that must win).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { scheduleAllReminders } = require('./notificationService');
    await scheduleAllReminders(true);
  } catch {
    // Notifications not available, silently skip
  }
}

/**
 * In-app "Missed X" nudge for unlogged meal slots. Gated by the Meal
 * Logger reminders toggle. The threshold is slot+45 min so this can never
 * feel like a duplicate of the system reminder that fires at the slot
 * time itself (the old +5 min offset read as a double pop).
 */
export async function checkMealReminderNotifications(
  addNotification: (title: string, body: string) => void,
  loggedMealTypes: Set<string>,
) {
  if (useMealStore.getState().mealRemindersEnabled === false) return;
  const cache = await loadRemindedCache();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  let didUpdate = false;

  for (const { slot, hour, minute, label } of MEAL_SLOTS) {
    if (loggedMealTypes.has(slot)) continue;
    if (cache[slot]) continue;
    if (currentHour < hour || (currentHour === hour && currentMinute < minute + 45)) continue;
    if (currentHour > hour + 3) continue;

    addNotification(
      `Missed ${label}`,
      `You haven't logged your ${label.toLowerCase()} meal yet. Log it now!`,
    );

    cache[slot] = true;
    didUpdate = true;
  }

  if (didUpdate) {
    await saveRemindedCache(cache);
  }
}
