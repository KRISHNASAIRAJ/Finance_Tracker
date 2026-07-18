import { Platform } from 'react-native';

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('diet-reminders', {
        name: 'Diet Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return true;
  } catch {
    return false;
  }
}

export async function scheduleDietNotifications(
  _meals: Record<string, { breakfast: string; lunch: string; dinner: string; snack: string }>
): Promise<void> {
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

    const DAY_MAP: Record<string, number> = {
      Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5,
      Friday: 6, Saturday: 7, Sunday: 1,
    };

    const MEAL_CONFIGS = [
      { slot: 'breakfast', hour: 5, minute: 30, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { slot: 'lunch', hour: 6, minute: 0, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      { slot: 'dinner', hour: 18, minute: 0, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      { slot: 'snack', hour: 17, minute: 0, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    ];

    for (const config of MEAL_CONFIGS) {
      for (const dayName of config.days) {
        const dayNum = DAY_MAP[dayName];
        const dayMeals = _meals[dayName];
        if (!dayMeals) continue;

        const mealName = dayMeals[config.slot as keyof typeof dayMeals] || 'Not planned';

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${config.slot.charAt(0).toUpperCase() + config.slot.slice(1)} — ${dayName}`,
            body: mealName,
            data: { screen: 'DietPlanTracker', day: dayName, slot: config.slot },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: dayNum,
            hour: config.hour,
            minute: config.minute,
            channelId: 'diet-reminders',
          },
        });
      }
    }
  } catch {
    // Notifications not available, silently skip
  }
}
