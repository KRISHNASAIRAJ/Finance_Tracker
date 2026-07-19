import { Platform } from 'react-native';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';

let isScheduling = false;
let Notifications: any = null;
let _initialized = false;
let channelsCreated = false;

function ensureInit() {
  if (_initialized) return Notifications !== null;
  _initialized = true;
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    setupChannels();
    return true;
  } catch {
    Notifications = null;
    return false;
  }
}

async function setupChannels() {
  if (channelsCreated || Platform.OS !== 'android' || !Notifications) return;
  try {
    const channels = [
      { id: 'task_reminders', name: 'Task Reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
      { id: 'sms_expense', name: 'Expense Detection', importance: Notifications.AndroidImportance.HIGH, sound: 'default' },
      { id: 'portfolio', name: 'Portfolio Updates', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' },
      { id: 'bills_due', name: 'Bills & Due Dates', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
    ];
    for (const ch of channels) {
      await Notifications.setNotificationChannelAsync(ch.id, ch);
    }
    channelsCreated = true;
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!ensureInit()) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function scheduleLocal(
  title: string,
  body: string,
  triggerDate: Date,
  channelId: string = 'bills_due'
) {
  if (!ensureInit()) return;
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
        channelId,
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
  if (!ensureInit() || isScheduling) return;
  const granted = await requestNotificationPermission();
  if (!granted) return;

  isScheduling = true;
  try {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();

    const { cards, receivables } = useFinanceStore.getState();
    const { tasks } = useTasksStore.getState();

    // Credit card bill reminders
    for (const card of (cards || [])) {
      const billAmt = card.billAmount ?? card.balance;
      const paidAmt = card.paidAmount ?? 0;
      const billLeft = Math.max(0, billAmt - paidAmt);
      if (billLeft <= 0) continue;

      const dueDate = new Date(card.dueDate);
      const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 9, 0, 0);
      const now = new Date();
      const cardName = card.name;
      const billStr = `\u20B9${(billAmt / 100).toLocaleString('en-IN')}`;
      const leftStr = `\u20B9${(billLeft / 100).toLocaleString('en-IN')}`;

      // 2 days before due
      const remind2d = new Date(dueDateStart.getTime() - 2 * 86400000);
      if (remind2d > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} Bill Due`,
          `${billStr} due on ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Pay now to avoid late fees.`,
          remind2d
        );
      }

      // On due date
      const onDue = new Date(dueDateStart);
      if (onDue > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} Bill Due Today`,
          `${billStr} is due today. Pay now to avoid late charges.`,
          onDue
        );
      }

      // Overdue reminders — if bill is past due and unpaid, schedule recurring nudges
      if (dueDateStart < now) {
        // Schedule for today + 1h, tomorrow, 3d, 7d
        const overdueIntervals = [1, 24, 72, 168]; // hours from now
        for (const hours of overdueIntervals) {
          const overdueDate = new Date(now.getTime() + hours * 3600000);
          overdueDate.setMinutes(0, 0, 0);
          await scheduleLocal(
            `\u23F0 ${cardName} Bill Overdue`,
            `${leftStr} still pending. Due was ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
            overdueDate
          );
        }
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
          isLent ? `\u{1F4B0} Collect from ${rec.personName}` : `\u{1F4B8} Pay ${rec.personName}`,
          `\u20B9${(rec.amount / 100).toLocaleString('en-IN')} ${isLent ? 'to be collected' : 'to pay back'} on ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
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
        const priorityEmoji = task.priority === 'urgent' ? '\u{1F534}' : task.priority === 'high' ? '\u{1F7E0}' : '\u{1F7E1}';
        const subtasks = task.subtasks || [];
        await scheduleLocal(
          `${priorityEmoji} Task: ${task.name}`,
          `Due tomorrow. ${subtasks.length > 0 ? `${subtasks.filter((s: any) => !s.completed).length} subtasks remaining.` : ''}`,
          remindDate
        );
      }
    }
  } finally {
    isScheduling = false;
  }
}
