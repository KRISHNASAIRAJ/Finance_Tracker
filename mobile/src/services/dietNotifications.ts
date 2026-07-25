import { Platform } from 'react-native';
import { isExpoGo } from '../shared/isExpoGo';

const MEAL_SLOTS = [
  { slot: 'breakfast', hour: 9, minute: 0, label: 'Breakfast' },
  { slot: 'lunch', hour: 14, minute: 15, label: 'Lunch' },
  { slot: 'snack', hour: 18, minute: 30, label: 'Snack' },
  { slot: 'dinner', hour: 21, minute: 30, label: 'Dinner' },
];

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
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const { slot, hour, minute, label } of MEAL_SLOTS) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${label} Time`,
          body: `Time to log your ${slot === 'lunch' ? 'lunch' : slot} meal!`,
          data: { screen: 'MealLogger', slot },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'diet-reminders',
        },
      });
    }
  } catch {
    // Notifications not available, silently skip
  }
}

export function checkMealReminderNotifications(
  addNotification: (title: string, body: string) => void,
  loggedMealTypes: Set<string>,
) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  for (const { slot, hour, minute, label } of MEAL_SLOTS) {
    if (loggedMealTypes.has(slot)) continue;
    if (currentHour < hour || (currentHour === hour && currentMinute < minute + 5)) continue;
    if (currentHour > hour + 3) continue;

    addNotification(
      `Missed ${label}`,
      `You haven't logged your ${label.toLowerCase()} meal yet. Log it now!`,
    );
  }
}
