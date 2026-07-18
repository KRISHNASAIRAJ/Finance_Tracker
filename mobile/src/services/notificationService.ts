import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';

let isScheduling = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleLocal(
  title: string,
  body: string,
  triggerDate: Date,
  channelId: string = 'default'
) {
  const now = new Date();
  if (triggerDate <= now) return;

  const secondsUntil = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
  if (secondsUntil <= 0) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });
  } catch {}
}

function getNextBillingDate(billingDay: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(billingDay, lastDayOfMonth);
  let next = new Date(year, month, safeDay, 9, 0, 0);
  if (next <= now) {
    const nextMonth = month + 1;
    const nextLastDay = new Date(year, nextMonth + 1, 0).getDate();
    const nextSafeDay = Math.min(billingDay, nextLastDay);
    next = new Date(year, nextMonth, nextSafeDay, 9, 0, 0);
  }
  return next;
}

export async function scheduleAllReminders() {
  if (isScheduling) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  isScheduling = true;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const { cards, receivables } = useFinanceStore.getState();
    const { tasks } = useTasksStore.getState();

    // Credit card bill reminders — 2 days before due
    for (const card of (cards || [])) {
      if (card.balance <= 0) continue;
      const dueDate = new Date(card.dueDate);
      const remindDate = new Date(dueDate.getTime() - 2 * 86400000);
      const now = new Date();
      if (remindDate > now) {
        await scheduleLocal(
          `💳 ${card.name} Bill Due`,
          `₹${(card.balance / 100).toLocaleString('en-IN')} due on ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Pay now to avoid late fees.`,
          remindDate
        );
      }
    }

    // Lent/Borrowed reminders — 1 day before due
    for (const rec of (receivables || [])) {
      const dueDate = new Date(rec.dueDate);
      const remindDate = new Date(dueDate.getTime() - 86400000);
      const now = new Date();
      if (remindDate > now) {
        const isLent = rec.type === 'lent';
        await scheduleLocal(
          isLent ? `💰 Collect from ${rec.personName}` : `💸 Pay ${rec.personName}`,
          `₹${(rec.amount / 100).toLocaleString('en-IN')} ${isLent ? 'to be collected' : 'to pay back'} on ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
          remindDate
        );
      }
    }

    // Task reminders — 1 day before due
    for (const task of (tasks || [])) {
      if (task.completed) continue;
      const dueDate = new Date(task.dueDate);
      const remindDate = new Date(dueDate.getTime() - 86400000);
      const now = new Date();
      if (remindDate > now) {
        const priorityEmoji = task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : '🟡';
        const subtasks = task.subtasks || [];
        await scheduleLocal(
          `${priorityEmoji} Task: ${task.name}`,
          `Due tomorrow. ${subtasks.length > 0 ? `${subtasks.filter(s => !s.completed).length} subtasks remaining.` : ''}`,
          remindDate
        );
      }
    }
  } finally {
    isScheduling = false;
  }
}
