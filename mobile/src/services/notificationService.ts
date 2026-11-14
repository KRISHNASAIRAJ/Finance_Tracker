/**
 * notificationService — Central notification scheduling for tasks, finance goals, meals, and vehicles.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { useFinanceStore } from '../modules/finance/store';
import { useTasksStore } from '../modules/tasks/store';
import { useMealStore } from '../modules/meals/store';
import { useGarageStore } from '../modules/garage/store';
import { usePersonalStore } from '../modules/personal/store';
import { isExpoGo } from '../shared/isExpoGo';
import { quoteForDate } from '../shared/dailyContent';

const WALLET_TARGET = 4000000;

/** Notification category + actions for the pill reminders. */
export const MEDICATION_CATEGORY = 'medication-reminder';
export const MEDICATION_ACTION_SKIP = 'medication_skip';
export const MEDICATION_ACTION_REMIND_30 = 'medication_remind_30';

interface MealSlot { slot: string; hour: number; minute: number; label: string }

/**
 * Single source of truth for meal reminder slots (IST).
 * dietNotifications.ts imports this — do NOT duplicate the table.
 */
export const MEAL_SLOTS: MealSlot[] = [
  { slot: 'breakfast', hour: 9, minute: 0, label: 'Breakfast' },
  { slot: 'lunch', hour: 14, minute: 15, label: 'Lunch' },
  { slot: 'snack', hour: 18, minute: 30, label: 'Snack' },
  // Dinner moved 21:30 → 20:30 so it no longer stacks with other 21:30 pings.
  { slot: 'dinner', hour: 20, minute: 30, label: 'Dinner' },
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
// Cooldown so repeated mount-time calls can't cancel-all + reschedule in a
// tight loop. Explicit change points (task save/delete, toggles) pass
// force=true to bypass it.
const RESCHEDULE_COOLDOWN_MS = 45000;
let lastScheduleRun = 0;
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
      { id: 'sleep-reminders', name: 'Sleep Reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' },
      { id: 'morning-brief', name: 'Morning Brief', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' },
      { id: 'offers', name: 'Offers & Coupons', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
      { id: 'medication-reminders', name: 'Pill Reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 250, 250, 250] },
      { id: 'people_digest', name: 'Keep in Touch', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' },
    ];
    for (const ch of channels) {
      await Notifications.setNotificationChannelAsync(ch.id, ch);
    }
    // Notification categories give the medication reminders their action
    // buttons (Skip / Remind in 30 min) in the notification panel.
    if (typeof Notifications.setNotificationCategoryAsync === 'function') {
      await Notifications.setNotificationCategoryAsync(MEDICATION_CATEGORY, [
        { identifier: MEDICATION_ACTION_SKIP, buttonTitle: 'Skip', options: { destructive: true } },
        { identifier: MEDICATION_ACTION_REMIND_30, buttonTitle: 'Remind in 30 min' },
      ]);
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
  categoryIdentifier?: string,
) {
  if (!ensureInit()) return;
  const now = istNow();
  if (triggerDate <= now) {
    console.log('[notificationService] Skipping past trigger:', title, triggerDate.toISOString());
    return;
  }

  try {
    // Dedup guard — if a notification with the same dedupKey is already
    // scheduled, replace it instead of stacking a second identical one.
    // This is what prevents duplicate task/meal reminders when
    // scheduleAllReminders() runs from multiple screens' mounts.
    const dedupKey = data?.dedupKey;
    if (dedupKey) {
      try {
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of existing) {
          if (n?.content?.data?.dedupKey === dedupKey) {
            await Notifications.cancelScheduledNotificationAsync(n.id);
          }
        }
      } catch (e) { console.warn('[notificationService] dedup scan failed:', e); }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.HIGH,
        channelId,
        data: data || {},
        ...(categoryIdentifier ? { categoryIdentifier } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (e) { console.warn('[notificationService] scheduleLocal failed:', title, e); }
}

/**
 * Fire a notification immediately (used for live portfolio day-change updates).
 * Dedupes on `dedupKey` so repeated refreshes never stack duplicates.
 */
export async function scheduleImmediate(
  title: string,
  body: string,
  channelId: string = 'portfolio',
  data?: Record<string, string>,
) {
  if (!ensureInit()) return;
  try {
    const dedupKey = data?.dedupKey ?? `imm_${title}_${new Date().toISOString().slice(0, 13)}`;
    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of existing) {
        if (n?.content?.data?.dedupKey === dedupKey) {
          await Notifications.cancelScheduledNotificationAsync(n.id);
        }
      }
    } catch { /* dedup scan is best-effort */ }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        channelId,
        data: { ...(data || {}), dedupKey },
      },
      trigger: null,
    });
  } catch (e) { console.warn('[notificationService] scheduleImmediate failed:', title, e); }
}

/**
 * Cancel any scheduled notification that carries this dedupKey.
 * Best-effort; never throws.
 */
export async function cancelNotificationByDedupKey(dedupKey: string): Promise<void> {
  if (!dedupKey || !ensureInit() || !Notifications) return;
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if (n?.content?.data?.dedupKey === dedupKey) {
        await Notifications.cancelScheduledNotificationAsync(n.id);
      }
    }
  } catch (e) { console.warn('[notificationService] cancel by dedupKey failed:', dedupKey, e); }
}

/** Cancel a task's due-time reminder (keyed by task id). */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  await cancelNotificationByDedupKey(`task_${taskId}`);
}

/**
 * Replace the single due-time reminder for a task (deduped on task id).
 * Cancels any stale schedule first, then schedules one only when the task
 * is still open and its due date is in the future.
 */
export async function scheduleTaskReminder(task: {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  completed?: boolean;
}): Promise<void> {
  if (!task) return;
  await cancelTaskReminder(task.id);
  if (task.completed) return;
  const dueDate = new Date(task.dueDate);
  if (isNaN(dueDate.getTime())) return;
  if (dueDate <= istNow()) return;

  const dueStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const dueTimeStr = dueDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  await scheduleLocal(
    `${task.name}, ${dueStr} ${dueTimeStr}`,
    task.description || 'Task due now',
    dueDate,
    'task_reminders',
    { screen: 'TaskDetail', taskId: task.id, dedupKey: `task_${task.id}` }
  );
}

/**
 * Offers expiring soon — remind 3 days and 2 days before the expiry date at
 * 6:00 PM IST. Cancels every previously scheduled offer reminder first so
 * edits and deletes never leave stale ones behind (offer reminders are a pure
 * derivation of current offer state). Safe to call from the offers store on
 * every CRUD, and from scheduleAllReminders() on app launch.
 */
export async function refreshOfferReminders(): Promise<void> {
  if (!ensureInit() || !Notifications) return;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      const key = n?.content?.data?.dedupKey;
      if (typeof key === 'string' && key.startsWith('offer_')) {
        await Notifications.cancelScheduledNotificationAsync(n.id);
      }
    }
  } catch (e) { console.warn('[notificationService] offer cancel failed:', e); }

  try {
    const { useOffersStore } = require('../modules/offers/store');
    const offers = (useOffersStore.getState().offers || []) as Array<{
      id: string; title: string; merchant?: string; couponCode?: string;
      discountValue?: string; expiresOn: string;
    }>;
    const now = istNow();
    for (const offer of offers) {
      if (!offer?.expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(offer.expiresOn)) continue;
      const [yy, mm, dd] = offer.expiresOn.split('-').map(Number);
      const expiry = new Date(yy, mm - 1, dd);
      if (isNaN(expiry.getTime())) continue;
      for (const daysBefore of [3, 2]) {
        const at = new Date(yy, mm - 1, dd - daysBefore, 18, 0, 0, 0);
        if (at <= now) continue;
        const dateKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
        const label = offer.merchant ? `${offer.title} (${offer.merchant})` : offer.title;
        const extras = [
          offer.discountValue || null,
          offer.couponCode ? `code ${offer.couponCode}` : null,
        ].filter(Boolean).join(' · ');
        await scheduleLocal(
          `\u{1F3F7}\u{FE0F} ${label} expires in ${daysBefore} days`,
          `${extras ? extras + ' · ' : ''}Use it before ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
          at,
          'offers',
          { screen: 'Offers', dedupKey: `offer_${offer.id}_${dateKey}` }
        );
      }
    }
  } catch (e) { console.warn('[notificationService] offer reminders failed:', e); }
}

/**
 * The daily "keep in touch" digest.
 *
 * ONE notification at 10:00 AM listing everyone who is due that day — the
 * people you want to stay in touch with (weekly / monthly / every 45 days /
 * every N days). It is re-armed whenever the list changes and by
 * scheduleAllReminders() on every app open.
 */
export async function schedulePeopleDigest(): Promise<void> {
  if (!ensureInit() || !Notifications) return;
  try {
    const { usePeopleStore } = require('../modules/people/store');
    const due = (usePeopleStore.getState().getDue?.(new Date()) || []) as Array<{ name: string }>;

    // Cancel the previous digest (today's or tomorrow's).
    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of existing) {
        const key = n?.content?.data?.dedupKey;
        if (typeof key === 'string' && key.startsWith('people_digest_')) {
          await Notifications.cancelScheduledNotificationAsync(n.id);
        }
      }
    } catch (e) { console.warn('[notificationService] people digest cancel failed:', e); }

    if (due.length === 0) return;

    const now = istNow();
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    const dateKey = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    const names = due.slice(0, 5).map((p) => p.name).join(', ');
    const more = due.length > 5 ? ` +${due.length - 5} more` : '';
    const title = due.length === 1 ? 'Time to catch up' : `${due.length} people to catch up with`;
    const body = `${names}${more}`;

    await scheduleLocal(
      title,
      body,
      at,
      'people_digest',
      { dedupKey: `people_digest_${dateKey}`, url: 'meridian://people' },
    );
  } catch (e) {
    console.warn('[notificationService] people digest failed:', e);
  }
}

export async function scheduleAllReminders(force = false) {
  if (isScheduling) return;
  if (!force && Date.now() - lastScheduleRun < RESCHEDULE_COOLDOWN_MS) {
    console.log('[notificationService] scheduleAllReminders: cooldown active, skipping');
    return;
  }
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
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) { console.warn('[notificationService] cancelAll failed (continuing):', e); }

    // Meal reminders — ONE per slot per day, only for slots not yet logged today.
    // No recurring daily triggers (that caused notification spam).
    // Gated by the user's Meal Logger toggle (mealRemindersEnabled).
    const nowIst = istNow();
    const todayKey = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}-${String(nowIst.getDate()).padStart(2, '0')}`;
    const mealRemindersOn = useMealStore.getState().mealRemindersEnabled !== false;
    const { entries: mealEntries } = useMealStore.getState();
    const loggedMealTypes = new Set(
      (mealEntries || [])
        .filter((e: any) => e.date.slice(0, 10) === todayKey)
        .map((e: any) => e.mealType)
    );
    for (const { slot, hour, minute, label } of MEAL_SLOTS) {
      if (!mealRemindersOn) break;
      if (loggedMealTypes.has(slot)) continue;
      const triggerTime = new Date(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate(), hour, minute, 0);
      if (triggerTime <= nowIst) continue;
      await scheduleLocal(
        `${label} Time`,
        `Time to log your ${slot === 'lunch' ? 'lunch' : slot} meal!`,
        triggerTime,
        'diet-reminders',
        { screen: 'MealLogger', slot, dedupKey: `meal_${todayKey}_${slot}` }
      );
    }

    const { cards, receivables, fixedExpenses } = useFinanceStore.getState();
    const { tasks } = useTasksStore.getState();

    // Fixed-expense due reminders — unpaid obligations get a nudge at 9 AM
    // on their due date (rent/electricity/SIPs due 1st, Emergency Fund SIP
    // due on the last day of the month).
    const currentMonthKey = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, '0')}`;
    for (const fx of (fixedExpenses || [])) {
      if (fx.lastPaidMonth === currentMonthKey) continue;
      const fxDue = new Date(fx.dueDate);
      if (isNaN(fxDue.getTime())) continue;
      const fxDueStart = new Date(fxDue.getFullYear(), fxDue.getMonth(), fxDue.getDate(), 9, 0, 0);
      if (fxDueStart <= nowIst) continue;
      const fxAmount = `\u20B9${(fx.amount / 100).toLocaleString('en-IN')}`;
      await scheduleLocal(
        `\u{1F4B0} ${fx.name} Due Today`,
        `${fxAmount} due today${fx.name.toLowerCase().includes('emergency') ? ' — SIP into Kite (Zerodha)' : ''}.`,
        fxDueStart,
        'bills_due',
        { screen: 'FixedExpenses', dedupKey: `fx_${fx.id}_${fxDueStart.toISOString().slice(0, 10)}` }
      );
    }

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
          remind2d,
          'bills_due',
          { dedupKey: `card_${card.id}_due2d_${dueDateStart.toISOString().slice(0, 10)}` }
        );
      }

      // On due date
      const onDue = new Date(dueDateStart);
      if (onDue > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} Bill Due Today`,
          `${billStr} is due today. Pay now to avoid late charges.`,
          onDue,
          'bills_due',
          { dedupKey: `card_${card.id}_due_${dueDateStart.toISOString().slice(0, 10)}` }
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
            overdueDate,
            'bills_due',
            { dedupKey: `card_${card.id}_overdue_${hours}h` }
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
          'bills_due',
          { dedupKey: `card_${card.id}_amc30d_${nextAc.getFullYear()}` }
        );
      }

      const remind7d = new Date(nextAc.getTime() - 7 * 86400000);
      if (remind7d > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} AMC Due Soon`,
          `${amcStr} annual charges due on ${dueStr} (in 1 week).`,
          remind7d,
          'bills_due',
          { dedupKey: `card_${card.id}_amc7d_${nextAc.getFullYear()}` }
        );
      }

      if (nextAc > now) {
        await scheduleLocal(
          `\u{1F4B3} ${cardName} AMC Due Today`,
          `${amcStr} annual charges due today (${dueStr}).`,
          nextAc,
          'bills_due',
          { dedupKey: `card_${card.id}_amc_${nextAc.getFullYear()}` }
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
          { screen: 'LentBorrowed', dedupKey: `recv_${rec.id}_due_${tenAm.toISOString().slice(0, 10)}_am` }
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
          { screen: 'LentBorrowed', dedupKey: `recv_${rec.id}_due_${eightThirtyPm.toISOString().slice(0, 10)}_pm` }
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
            { screen: 'LentBorrowed', dedupKey: `recv_${rec.id}_od_${d}_am` }
          );
          const eveningReminder = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 20, 30, 0);
          await scheduleLocal(
            `\u23F0 ${isLent ? 'Collect' : 'Pay'} ${personName}`,
            `${amountStr} ${isLent ? 'still to be collected from' : 'still to pay to'} ${personName}. Due was ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
            eveningReminder,
            'bills_due',
            { screen: 'LentBorrowed', dedupKey: `recv_${rec.id}_od_${d}_pm` }
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
          'bills_due',
          { dedupKey: `wallet_thu_${nextThu.toISOString().slice(0, 10)}` }
        );
      }
    }

    // Buy List / Grocery List date reminders — ONE 9 AM nudge on the item's
    // date (incomplete items only, next 60 days max — no spam).
    const { buyListItems, groceryItems } = usePersonalStore.getState();
    const listEntities: Array<{ entity: 'buy_list_items' | 'grocery_items'; items: Array<{ id: string; name: string; itemDate: string | null; completed: boolean; quantity?: string }> }> = [
      { entity: 'buy_list_items', items: buyListItems || [] },
      { entity: 'grocery_items', items: groceryItems || [] },
    ];
    for (const { entity, items } of listEntities) {
      for (const item of items) {
        if (item.completed || !item.itemDate) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.itemDate)) continue;
        const itemDay = new Date(item.itemDate + 'T00:00:00');
        if (isNaN(itemDay.getTime())) continue;
        // Cap: only schedule for dates within the next 60 days
        const nowIst = istNow();
        const daysAhead = Math.ceil((itemDay.getTime() - nowIst.getTime()) / 86400000);
        if (daysAhead < 0 || daysAhead > 60) continue;
        const trigger = new Date(itemDay.getFullYear(), itemDay.getMonth(), itemDay.getDate(), 9, 0, 0);
        if (trigger <= nowIst) continue;
        const label = entity === 'grocery_items' ? 'Grocery' : 'Buy List';
        const qty = 'quantity' in item && item.quantity ? ` (${item.quantity})` : '';
        await scheduleLocal(
          `${label}: ${item.name}`,
          `On your ${label.toLowerCase()} list for today${qty}. Time to get it!`,
          trigger,
          'bills_due',
          { screen: entity === 'grocery_items' ? 'GroceryList' : 'BuyList', dedupKey: `${entity}_${item.id}_${item.itemDate}` }
        );
      }
    }

    // Task reminders — one notification at the exact due time
    for (const task of (tasks || [])) {
      await scheduleTaskReminder(task);
    }

    // Sleep bedtime reminder — nightly at the user's configured time
    // (Sleep Tracker settings). Default 23:00 IST when unset; off when null.
    try {
      const { useSleepStore } = require('../modules/sleep/store');
      const { reminderTime } = useSleepStore.getState();
      if (reminderTime) {
        const t = istNow();
        const triggerTime = new Date(
          t.getFullYear(), t.getMonth(), t.getDate(),
          reminderTime.hour, reminderTime.minute, 0, 0
        );
        // If today's time already passed, schedule for tomorrow night.
        if (triggerTime <= t) triggerTime.setDate(triggerTime.getDate() + 1);
        await scheduleLocal(
          '\u{1F319} Bedtime',
          'Time to wind down — tap "Going to bed" in Sleep Tracker.',
          triggerTime,
          'sleep-reminders',
          { screen: 'SleepTracker', dedupKey: `bedtime_${triggerTime.toISOString().slice(0, 10)}` }
        );
      }
    } catch (e) { console.warn('[notificationService] sleep reminder failed:', e); }

    // Weekly review — next Sunday at 9:00 AM: the week at a glance, deep
    // link into the Weekly review screen.
    try {
      const t0 = istNow();
      for (let d = 0; d <= 7; d++) {
        const sunday = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d, 9, 0, 0, 0);
        if (sunday <= t0) continue;
        if (sunday.getDay() !== 0) continue;
        await scheduleLocal(
          '\u{1F9ED} Weekly review',
          'Your week at a glance — score, wins and next week\u2019s focus.',
          sunday,
          'morning-brief',
          { screen: 'WeeklyReview', dedupKey: `weekly_review_${sunday.toISOString().slice(0, 10)}` }
        );
        break;
      }
    } catch (e) { console.warn('[notificationService] weekly review failed:', e); }

    // Morning brief — 7:30 AM IST daily for the next 7 days: today's quote +
    // a nudge to open Home (habit progress). Deep-links to the Home tab.
    // (Retimed from 9:00 so it no longer lands with the 9:00 breakfast ping.)
    try {
      const t0 = istNow();
      for (let d = 0; d < 7; d++) {
        const morning = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d, 7, 30, 0, 0);
        if (morning <= t0) continue;
        const day = new Date(morning);
        const q = quoteForDate(day);
        await scheduleLocal(
          `\u{2600}\u{FE0F} ${q.text.length > 80 ? q.text.slice(0, 77) + '…' : q.text}`,
          'Open Meridian — check today\u2019s habits & plan.',
          morning,
          'morning-brief',
          { screen: 'MainHome', dedupKey: `morning_${day.toISOString().slice(0, 10)}` }
        );
      }
    } catch (e) { console.warn('[notificationService] morning brief failed:', e); }

    // Offers expiring soon — 3 & 2 days before expiry at 6:00 PM IST.
    await refreshOfferReminders();

    // The daily "keep in touch" digest — ONE notification at 10:00 AM listing
    // everyone who is due that day.
    await schedulePeopleDigest();

    // Vehicle service reminders — next service at lastGeneralServiceKm + interval km
    // OR lastGeneralServiceDate + interval months (whichever first). Only
    // 'General Service' logs reset the clock; other services (wash, insurance,
    // tyre...) are ignored. Intervals are user-editable per vehicle.
    const { vehicles, fills, maintenance, serviceReminderSettings } = useGarageStore.getState();
    const { getNextServiceInfo } = require('../modules/garage/store');
    const now = istNow();
    const WARN_KM_LEFT = 200;
    const WARN_DAYS_LEFT = 14;
    for (const vehicle of (vehicles || [])) {
      const vMaint = (maintenance || []).filter((m) => m.vehicle === vehicle);
      if (vMaint.length === 0) continue;

      const vFills = (fills || []).filter((f) => f.vehicle === vehicle);
      const currentKm = vFills.length > 0 ? Math.max(...vFills.map((f) => f.odometer || 0)) : 0;

      const info = getNextServiceInfo(vehicle, maintenance || [], currentKm, serviceReminderSettings?.[vehicle]);
      if (!info) continue;
      const { dueKm, dueDate, lastServiceDate } = info;

      const intervalMonths = serviceReminderSettings?.[vehicle]?.intervalMonths ?? 3;

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
        body = `Last general service was ${lastServiceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Book the ${intervalMonths}-month service soon.`;
      }

      if (title && body) {
        // ONE nudge per day, at 9 AM (today if that is still ahead, else
        // tomorrow). The old trigger was "now + 60 min" with a constant
        // dedup key, so every app open re-armed it and a due service could
        // notify every hour. The day-keyed dedup makes it strictly once a
        // day per vehicle.
        const trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
        if (trigger <= now) trigger.setDate(trigger.getDate() + 1);
        const triggerDay = `${trigger.getFullYear()}-${String(trigger.getMonth() + 1).padStart(2, '0')}-${String(trigger.getDate()).padStart(2, '0')}`;
        await scheduleLocal(
          title,
          body,
          trigger,
          'bills_due',
          { screen: 'AllMaintenance', dedupKey: `service_${vehicle}_${triggerDay}` }
        );
      }
    }
  } finally {
    isScheduling = false;
    lastScheduleRun = Date.now();
  }
}
