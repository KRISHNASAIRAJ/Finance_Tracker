import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmsParseResult } from './smsParser';
import type { SmsMessage } from './smsReader';
import { isExpoGo } from '../shared/isExpoGo';

const SMS_CHANNEL = 'sms_expense';
let channelCreated = false;
let Notifications: any = null;

function getNotifications() {
  if (Notifications) return Notifications;
  if (isExpoGo()) return null;
  try {
    Notifications = require('expo-notifications');
    return Notifications;
  } catch {
    return null;
  }
}

async function ensureChannel() {
  const Notifs = getNotifications();
  if (!Notifs || channelCreated) return;
  try {
    await Notifs.setNotificationChannelAsync(SMS_CHANNEL, {
      name: 'Expense Detection',
      importance: Notifs.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
    channelCreated = true;
  } catch { }
}

const SMS_DEDUP_KEY = 'meridian_sms_processed_ids';
let processedIds = new Set<string>();

async function loadProcessedIds() {
  try {
    const raw = await AsyncStorage.getItem(SMS_DEDUP_KEY);
    if (raw) {
      processedIds = new Set(JSON.parse(raw));
    }
  } catch {}
}

function persistProcessedIds() {
  try {
    AsyncStorage.setItem(SMS_DEDUP_KEY, JSON.stringify([...processedIds]));
  } catch {}
}

async function ensureLoaded() {
  if (processedIds.size === 0) {
    await loadProcessedIds();
  }
}

export function markSmsProcessed(smsId: string) {
  processedIds.add(smsId);
  persistProcessedIds();
}

export function isSmsProcessed(smsId: string): boolean {
  return processedIds.has(smsId);
}

export async function notifySmsExpense(
  message: SmsMessage,
  parsed: SmsParseResult
): Promise<string | null> {
  const Notifs = getNotifications();
  if (!Notifs) return null;
  await ensureLoaded();
  if (isSmsProcessed(message.id)) return null;

  await ensureChannel();

  const amountDisplay = parsed.amount
    ? `\u20B9${(parsed.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : 'Unknown amount';

  const title = parsed.merchant
    ? `${amountDisplay} at ${parsed.merchant}`
    : `${amountDisplay} transaction detected`;

  const body = parsed.transactionType === 'credit'
    ? 'Tap to add as income'
    : 'Tap to classify this transaction';

  try {
    const id = await Notifs.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifs.AndroidNotificationPriority.HIGH,
        data: {
          type: 'SMS_EXPENSE_CONFIRM',
          smsId: message.id,
          smsBody: message.body.substring(0, 500),
          senderId: message.address,
          parsedAmount: parsed.amount,
          parsedMerchant: parsed.merchant,
          parsedCard: parsed.cardLast4,
          parsedAccount: parsed.accountLast4,
          parsedType: parsed.transactionType,
          confidence: parsed.confidence,
        },
      },
      trigger: null,
    });

    processedIds.add(message.id);
    return id;
  } catch {
    return null;
  }
}

export function setupNotificationTapHandler(
  onConfirm: (data: Record<string, unknown>) => void
): () => void {
  const Notifs = getNotifications();
  if (!Notifs) return () => {};

  try {
    const sub = Notifs.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'SMS_EXPENSE_CONFIRM') {
        onConfirm(data as Record<string, unknown>);
      }
    });

    return () => sub.remove();
  } catch {
    return () => {};
  }
}
