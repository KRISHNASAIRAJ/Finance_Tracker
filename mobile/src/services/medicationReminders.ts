/**
 * medicationReminders — schedules the pill reminders and handles the
 * notification action buttons:
 *
 *   ⏭  Skip              → the dose is marked as taken/skipped for today and
 *                           is not scheduled again
 *   ⏰ Remind in 30 min  → the reminder is re-scheduled 30 minutes later
 *
 * The buttons come from a notification category (see notificationService),
 * so they show up directly in the Android notification panel.
 */
import {
  scheduleLocal,
  MEDICATION_CATEGORY,
  MEDICATION_ACTION_SKIP,
  MEDICATION_ACTION_REMIND_30,
} from './notificationService';
import {
  useMedicationsStore,
  medDayKey,
  doseKey,
  nextDose,
  type Medication,
} from '../modules/medications/store';

const CHANNEL = 'medication-reminders';

/** Reminder payload keys (also written into the notification data). */
export const MED_KEY_ID = 'medId';
export const MED_KEY_DATE = 'dateKey';
export const MED_KEY_TIME = 'time';
export const MED_KEY_DOSE = 'doseKey';

/** How many days ahead the reminders are scheduled (rescheduled on boot). */
const DAYS_AHEAD = 2;

/**
 * Schedule the next reminder for every active medication. Called on app
 * boot, when a medication changes, and after a "Remind in 30 min" action.
 */
export async function scheduleMedicationReminders(now: Date = new Date()): Promise<void> {
  try {
    const { medications, skipped } = useMedicationsStore.getState();
    const active = (medications || []).filter((m) => m.active && m.times?.length);
    if (active.length === 0) return;

    const base = new Date(now);
    base.setHours(0, 0, 0, 0);

    for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
      const day = new Date(base);
      day.setDate(base.getDate() + dayOffset);
      const dateKey = medDayKey(day);

      for (const med of active) {
        for (const time of med.times) {
          const key = doseKey(med.id, dateKey, time);
          if (skipped?.[key]) continue; // already skipped for that day

          const at = new Date(day);
          const [h, m] = time.split(':').map((n) => parseInt(n, 10));
          at.setHours(h || 0, m || 0, 0, 0);
          if (at.getTime() <= now.getTime()) continue; // already passed today

          await scheduleLocal(
            `💊 Time for ${med.name}`,
            med.dosage ? `Take ${med.dosage}` : 'Time to take your pill',
            at,
            CHANNEL,
            {
              screen: 'PillReminder',
              [MED_KEY_ID]: med.id,
              [MED_KEY_DATE]: dateKey,
              [MED_KEY_TIME]: time,
              [MED_KEY_DOSE]: key,
            },
            MEDICATION_CATEGORY,
          );
        }
      }
    }
  } catch (e) {
    console.warn('[medicationReminders] scheduling failed:', e);
  }
}

/**
 * Handle a notification action press. Safe to call from the foreground
 * handler and from the background notification task.
 */
export async function handleMedicationAction(
  actionIdentifier: string,
  data: Record<string, string> | undefined,
  notificationId?: string
): Promise<boolean> {
  try {
    if (actionIdentifier !== MEDICATION_ACTION_SKIP && actionIdentifier !== MEDICATION_ACTION_REMIND_30) {
      return false;
    }
    const medId = data?.[MED_KEY_ID];
    const dateKey = data?.[MED_KEY_DATE];
    const time = data?.[MED_KEY_TIME];
    if (!medId || !dateKey || !time) return false;

    // Remove the delivered notification from the tray (best effort).
    if (notificationId) {
      try {
        const Notifications = require('expo-notifications');
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (_e) { /* already dismissed */ }
    }

    if (actionIdentifier === MEDICATION_ACTION_SKIP) {
      useMedicationsStore.getState().skipDose(medId, dateKey, time);
      return true;
    }

    // Remind in 30 minutes.
    const in30 = new Date(Date.now() + 30 * 60 * 1000);
    const med = useMedicationsStore.getState().medications.find((m) => m.id === medId);
    await scheduleLocal(
      `💊 ${med ? med.name : 'Pill'} — still due`,
      med?.dosage ? `Take ${med.dosage}` : 'Time to take your pill',
      in30,
      CHANNEL,
      {
        screen: 'PillReminder',
        [MED_KEY_ID]: medId,
        [MED_KEY_DATE]: dateKey,
        [MED_KEY_TIME]: time,
        [MED_KEY_DOSE]: doseKey(medId, dateKey, time),
      },
      MEDICATION_CATEGORY,
    );
    return true;
  } catch (e) {
    console.warn('[medicationReminders] action failed:', e);
    return false;
  }
}

/** Next dose for a medication (used by the pill reminder screen). */
export function upcomingDose(med: Medication, now: Date = new Date()): { time: string; at: Date } | null {
  return nextDose(med.times || [], now);
}
