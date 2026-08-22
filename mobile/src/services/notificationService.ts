/**
 * notificationService — Central notification scheduling for tasks, finance goals, meals, and vehicles.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';
import { useMealStore } from '../modules/meals/store';
import { useGarageStore } from '../modules/garage/store';
import { isExpoGo } from '../shared/isExpoGo';

const WALLET_TARGET = 4000000;

interface MealSlot { slot: string; hour: number; minute: number; label: string }

const MEAL_SLOTS: MealSlot[] = [
  { slot: 'breakfast', hour: 9, minute: 0, label: 'Breakfast' },
  { slot: 'lunch', hour: 14, minute: 15, label: 'Lunch' },
  { slot: 'snack', hour: 18, minute: 30, label: 'Snack' },
  { slot: 'dinner', hour: 21, minute: 30, label: 'Dinner' },
];

function ensureIST(date: Date): Date {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const localOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  if (Math.abs(localOffsetMs + istOffsetMs) > 60000) {
    return new Date(date.getTime() + istOffsetMs + localOffsetMs);
  }
  return date;
}

function istNow(): Date {
  return ensureIST(new Date());
}

function getCurrentMonthWalletLoad(): number {
  const { transactions } = useFinanceStore.getState();
  const now = istNow();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return transactions
    .filter((tx: any) =>
      (tx.category === 'Wallet Loads' || tx.category === 'Wallet Load' ||
       tx.notes?.toLowerCase().includes('wallet load') ||
       tx.notes?.toLowerCase().includes('payzapp')) &&
      new Date(tx.date) >= start
    )
    .reduce((s: number, t: any) => s + t.amount, 0);
}

function getNextThursday(): Date {
  const now = istNow();
  const day = now.getDay();
  const daysUntilThu = (4 - day + 7) % 7;
  const nextThu = new Date(now);
  nextThu.setDate(now.getDate() + (daysUntilThu === 0 ? 7 : daysUntilThu));
  nextThu.setHours(9, 0, 0, 0);
  return nextThu;
}

function formatCurrencyAmount(paise: number): string {
  return `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

let isScheduling = false;
let Notifications: any = null;
let _initialized = false;
let channelsCreated = false;

function ensureInit() {
  if (_initialized) return Notifications !== null;
  if (isExpoGo()) {
    console.warn('[notificationService] Blocked: running in Expo Go. Build a dev client (npx expo run:android) for notifications.');
    _initialized = true;
    return false;
  }
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
    console.log('[notificationService] Initialized successfully');
    return true;
  } catch (e) {
    console.warn('[notificationService] Init failed:', e);
    Notifications = null;
    return false;
  }
}

async function setupChannels() {
  if (channelsCreated || Platform.OS !== 'android' || !Notifications) return;
  try {
    const channels = [
      { id: 'task_reminders', name: 'Task Reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
      { id: 'portfolio', name: 'Portfolio Updates', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' },
      { id: 'bills_due', name: 'Bills & Due Dates', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
      { id: 'diet-reminders', name: 'Diet Reminders', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], sound: 'default' },
    ];
    for (const ch of channels) {
      await Notifications.setNotificationChannelAsync(ch.id, ch);
    }
    channelsCreated = true;
  } catch (e) { console.warn('[notificationService] Channel setup failed:', e); }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!ensureInit()) return false;

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      if (result !== 'granted') {
        console.warn('[notificationService] Android POST_NOTIFICATIONS denied:', result);
      }
    } catch (e) { console.warn('[notificationService] POST_NOTIFICATIONS request failed:', e); }
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) { console.warn('[notificationService] Permission request failed:', e); return false; }
}

export async function scheduleLocal(
  title: string,
  body: string,
  triggerDate: Date,
  channelId: string = 'bills_due',
  data?: Record<string, string>,
) {
  if (!ensureInit()) return;
  const now = istNow();
  if (triggerDate <= now) {
    console.log('[notificationService] Skipping past trigger:', title, triggerDate.toISOString());
    return;
  }

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
        data: data || {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });
  } catch (e) { console.warn('[notificationService] scheduleLocal failed:', title, e); }
}

export async function scheduleAllReminders() {
  if (isScheduling) return;
  isScheduling = true;
  try {
    if (!ensureInit()) {
      console.warn('[notificationService] scheduleAllReminders: ensureInit failed. isExpoGo:', isExpoGo());
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      console.warn('[notificationService] scheduleAllReminders: permission not granted');
      return;
    }

    if (!Notifications) return;
    console.log('[notificationService] Cancelling all + rescheduling...');
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Meal reminders — ONE per slot per day, only for slots not yet logged today.
    // No recurring daily triggers (that caused notification spam).
    const nowIst = istNow();
    const todayKey = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}-${String(nowIst.getDate()).padStart(2, '0')}`;
    const { entries: mealEntries } = useMealStore.getState();
    const loggedMealTypes = new Set(
      (mealEntries || [])
        .filter((e: any) => e.date.slice(0, 10) === todayKey)
        .map((e: any) => e.mealType)
    );
    for (const { slot, hour, minute, label } of MEAL_SLOTS) {
      if (loggedMealTypes.has(slot)) continue;
      const triggerTime = new Date(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate(), hour, minute, 0);
      if (triggerTime <= nowIst) continue;
      await scheduleLocal(
        `${label} Time`,
        `Time to log your ${slot === 'lunch' ? 'lunch' : slot} meal!`,
        triggerTime,
        'diet-reminders',
        { screen: 'MealLogger', slot }
      );
    }

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
      const now = istNow();
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

    // Credit card annual maintenance charge (AMC) reminders — 30 days before,
    // 7 days before, and on the due date (LTF cards get no reminder).
    for (const card of (cards || [])) {
      const amc = card.annualCharge ?? 0;
      if (amc <= 0 || card.isLtf || !card.annualChargeDate) continue;
      const acDate = new Date(card.annualChargeDate);
      if (isNaN(acDate.getTime())) continue;

      const now = istNow();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Compute the next occurrence of this month+day
      const nextAc = new Date(now.getFullYear(), acDate.getMonth(), acDate.getDate(), 9, 0, 0);
      if (nextAc < todayStart) {
        nextAc.setFullYear(now.getFullYear() + 1);
      }

      const cardName = card.name;
      const amcStr = `\u20B9${(amc / 100).toLocaleString('en-IN')}`;
      const dueStr = acDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      const remind30d = new Date(nextAc.getTime() - 30 * 86400000);
      if (remind30d > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} AMC Due in 1 Month`,
          `${amcStr} annual charges due on ${dueStr}. Start getting ready!`,
          remind30d,
          'bills_due'
        );
      }

      const remind7d = new Date(nextAc.getTime() - 7 * 86400000);
      if (remind7d > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} AMC Due Soon`,
          `${amcStr} annual charges due on ${dueStr} (in 1 week).`,
          remind7d,
          'bills_due'
        );
      }

      if (nextAc > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} AMC Due Today`,
          `${amcStr} annual charges due today (${dueStr}).`,
          nextAc,
          'bills_due'
        );
      }
    }

    // Lent/Borrowed reminders — at 10 AM and 8:30 PM on the due date, then recurring if overdue
    for (const rec of (receivables || [])) {
      if (rec.status === 'paid') continue;
      const dueDate = new Date(rec.dueDate);
      const now = istNow();
      const isLent = rec.type === 'lent';
      const personName = rec.personName;
      const amountStr = `\u20B9${(rec.amount / 100).toLocaleString('en-IN')}`;

      const tenAm = new Date(dueDate);
      tenAm.setHours(10, 0, 0, 0);
      if (tenAm > now) {
        await scheduleLocal(
          `${isLent ? 'Collect' : 'Pay'} ${personName}`,
          `${amountStr} ${isLent ? 'to be collected' : 'to pay back'}`,
          tenAm,
          'bills_due',
          { screen: 'LentBorrowed' }
        );
      }

      const eightThirtyPm = new Date(dueDate);
      eightThirtyPm.setHours(20, 30, 0, 0);
      if (eightThirtyPm > now) {
        await scheduleLocal(
          `${isLent ? 'Collect' : 'Pay'} ${personName}`,
          `${amountStr} ${isLent ? 'to be collected' : 'to pay back'}`,
          eightThirtyPm,
          'bills_due',
          { screen: 'LentBorrowed' }
        );
      }

      // Overdue recurring reminders — if past due and unpaid, remind daily at 10AM and 8:30PM
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 0, 0, 0);
      if (dueStart < now) {
        const overdueDays = Math.min(30, Math.ceil((now.getTime() - dueStart.getTime()) / 86400000));
        for (let d = 1; d <= Math.min(7, 31 - overdueDays); d++) {
          const morningReminder = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 10, 0, 0);
          await scheduleLocal(
            `\u23F0 ${isLent ? 'Collect' : 'Pay'} ${personName}`,
            `${amountStr} ${isLent ? 'still to be collected from' : 'still to pay to'} ${personName}. Due was ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
            morningReminder,
            'bills_due',
            { screen: 'LentBorrowed' }
          );
          const eveningReminder = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 20, 30, 0);
          await scheduleLocal(
            `\u23F0 ${isLent ? 'Collect' : 'Pay'} ${personName}`,
            `${amountStr} ${isLent ? 'still to be collected from' : 'still to pay to'} ${personName}. Due was ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
            eveningReminder,
            'bills_due',
            { screen: 'LentBorrowed' }
          );
        }
      }
    }

    // Payzapp wallet Thursday reminder — only if load < 40K
    const currentLoad = getCurrentMonthWalletLoad();
    if (currentLoad < WALLET_TARGET) {
      const nextThu = getNextThursday();
      const completed = formatCurrencyAmount(currentLoad);
      const left = formatCurrencyAmount(WALLET_TARGET - currentLoad);
      if (nextThu > istNow()) {
        await scheduleLocal(
          '\u{1F4B0} Payzapp Wallet Incomplete',
          `${completed} loaded. ${left} left to reach \u20B940K target this month. Load via HDFC Millennia debit for 1% cashback.`,
          nextThu,
          'bills_due'
        );
      }
    }

    // Task reminders — one notification at the exact due time
    const now = istNow();
    for (const task of (tasks || [])) {
      if (task.completed) continue;
      const dueDate = new Date(task.dueDate);
      if (isNaN(dueDate.getTime())) continue;
      if (dueDate <= now) continue;

      const dueStr = new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const dueTimeStr = new Date(dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      await scheduleLocal(
        `${task.name}, ${dueStr} ${dueTimeStr}`,
        task.description || 'Task due now',
        dueDate,
        'task_reminders',
        { screen: 'TaskDetail', taskId: task.id }
      );
    }

    // Vehicle service reminders — next service at lastServiceKm + 3000 km OR lastServiceDate + 3 months
    // (whichever comes first). Alert when within 200 km or 14 days of the due window.
    const { vehicles, fills, maintenance } = useGarageStore.getState();
    const SERVICE_INTERVAL_KM = 3000;
    const SERVICE_INTERVAL_MONTHS = 3;
    const WARN_KM_LEFT = 200;
    const WARN_DAYS_LEFT = 14;
    for (const vehicle of (vehicles || [])) {
      const vMaint = (maintenance || []).filter((m) => m.vehicle === vehicle);
      if (vMaint.length === 0) continue;
      const lastService = [...vMaint].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const lastKm = typeof lastService.odometer === 'number' ? lastService.odometer : null;
      const lastDate = new Date(lastService.date);
      if (isNaN(lastDate.getTime())) continue;

      const vFills = (fills || []).filter((f) => f.vehicle === vehicle);
      const currentKm = vFills.length > 0 ? Math.max(...vFills.map((f) => f.odometer || 0)) : 0;

      let dueKm: number | null = null;
      if (typeof lastKm === 'number' && lastKm > 0) dueKm = lastKm + SERVICE_INTERVAL_KM;

      const dueDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + SERVICE_INTERVAL_MONTHS, lastDate.getDate());

      let title: string | null = null;
      let body: string | null = null;

      const kmWindow = dueKm !== null && dueKm - currentKm <= WARN_KM_LEFT;
      const dateWindow = now >= new Date(dueDate.getTime() - WARN_DAYS_LEFT * 86400000);

      if (dueKm !== null && kmWindow) {
        title = `\u{1F6F5} ${vehicle} Service Due Soon`;
        const kmLeft = Math.max(0, dueKm - currentKm);
        body = kmLeft <= 0
          ? `Next service due at ${dueKm.toLocaleString('en-IN')} km. You're due now!`
          : `${kmLeft.toLocaleString('en-IN')} km left until the ${dueKm.toLocaleString('en-IN')} km service mark.`;
      } else if (dateWindow) {
        title = `\u{1F6F5} ${vehicle} Service Due by ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        body = `Last service was ${lastDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Book the ${SERVICE_INTERVAL_MONTHS}-month service soon.`;
      }

      if (title && body) {
        const trigger = new Date(now.getTime() + 30 * 60000);
        trigger.setMinutes(trigger.getMinutes() + 30, 0, 0);
        await scheduleLocal(
          title,
          body,
          trigger,
          'bills_due',
          { screen: 'AllMaintenance' }
        );
      }
    }
  } finally {
    isScheduling = false;
  }
}
