import * as Notifications from 'expo-notifications';
import { SmsParseResult } from './smsParser';
import type { SmsMessage } from './smsReader';

const SMS_CHANNEL = 'sms_expense';
let channelCreated = false;

async function ensureChannel() {
  if (channelCreated) return;
  await Notifications.setNotificationChannelAsync(SMS_CHANNEL, {
    name: 'Expense Detection',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  channelCreated = true;
}

let processedIds = new Set<string>();

export function markSmsProcessed(smsId: string) {
  processedIds.add(smsId);
}

export function isSmsProcessed(smsId: string): boolean {
  return processedIds.has(smsId);
}

export async function notifySmsExpense(
  message: SmsMessage,
  parsed: SmsParseResult
): Promise<string | null> {
  if (isSmsProcessed(message.id)) return null;

  await ensureChannel();

  const amountDisplay = parsed.amount
    ? `₹${(parsed.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : 'Unknown amount';

  const title = parsed.merchant
    ? `${amountDisplay} at ${parsed.merchant}`
    : `${amountDisplay} transaction detected`;

  const body = parsed.transactionType === 'credit'
    ? 'Tap to add as income'
    : 'Tap to classify this transaction';

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === 'SMS_EXPENSE_CONFIRM') {
      onConfirm(data as Record<string, unknown>);
    }
  });

  return () => sub.remove();
}
