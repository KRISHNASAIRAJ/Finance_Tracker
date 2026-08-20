import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpoGo } from '../shared/isExpoGo';

const MEAL_SLOTS = [
  { slot: 'breakfast', hour: 9, minute: 0, label: 'Breakfast' },
  { slot: 'lunch', hour: 14, minute: 15, label: 'Lunch' },
  { slot: 'snack', hour: 18, minute: 30, label: 'Snack' },
  { slot: 'dinner', hour: 21, minute: 30, label: 'Dinner' },
];

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
  } catch {}
}

export async function resetDailyReminders(): Promise<void> {
  remindedCache = { _today: getTodayKey() };
  await AsyncStorage.setItem(REMINDED_KEY, JSON.stringify(remindedCache));
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo()) return false;
  try {
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
  // Delegate to the single unified scheduler so it doesn't cancel other notifications.
  try {
    const { scheduleAllReminders } = require('./notificationService');
    await scheduleAllReminders();
  } catch {
    // Notifications not available, silently skip
  }
}

export async function checkMealReminderNotifications(
  addNotification: (title: string, body: string) => void,
  loggedMealTypes: Set<string>,
) {
  const cache = await loadRemindedCache();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  let didUpdate = false;

  for (const { slot, hour, minute, label } of MEAL_SLOTS) {
    if (loggedMealTypes.has(slot)) continue;
    if (cache[slot]) continue;
    if (currentHour < hour || (currentHour === hour && currentMinute < minute + 5)) continue;
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
