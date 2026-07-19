import { Platform, Alert } from 'react-native';
import { readExistingSms, processSmsBatch, startSmsListener, requestSmsPermissions, isSmsModuleAvailable } from './smsReader';
import { notifySmsExpense, setupNotificationTapHandler } from './smsNotificationHandler';
import { callAiSmsParse } from './smsAiFallback';
import type { SmsNotificationPayload, SmsMessage } from './smsReader';

let listenerCleanup: (() => void) | null = null;
let notificationTapCleanup: (() => void) | null = null;
let scannedHistorical = false;

export type OnConfirmSms = (data: Record<string, unknown>) => void;

export function initSmsHandler(onConfirmSms: OnConfirmSms) {
  if (Platform.OS !== 'android') return;

  notificationTapCleanup?.();
  notificationTapCleanup = setupNotificationTapHandler((payload) => {
    onConfirmSms(payload);
  });

  if (isSmsModuleAvailable()) {
    startListening();
  }
}

export function stopSmsHandler() {
  listenerCleanup?.();
  listenerCleanup = null;
  notificationTapCleanup?.();
  notificationTapCleanup = null;
}

async function startListening() {
  if (Platform.OS !== 'android') return;

  listenerCleanup?.();
  listenerCleanup = startSmsListener(async (payload) => {
    await handleSmsMatch(payload);
  });
}

async function handleSmsMatch(payload: SmsNotificationPayload) {
  const { message, parsed } = payload;

  if (parsed.confidence >= 0.7) {
    await notifySmsExpense(message, parsed);
    return;
  }

  // Confidence < 0.7 — try AI fallback
  try {
    const aiResult = await callAiSmsParse(message.body, message.address);
    if (aiResult.parsed && aiResult.confidence >= 0.7) {
      const enhanced = {
        ...parsed,
        amount: aiResult.amount ?? parsed.amount,
        merchant: aiResult.merchant ?? parsed.merchant,
        cardLast4: aiResult.card_last4 ?? parsed.cardLast4,
        accountLast4: aiResult.account_last4 ?? parsed.accountLast4,
        transactionType: aiResult.transaction_type ?? parsed.transactionType,
        confidence: aiResult.confidence,
      };
      await notifySmsExpense(message, enhanced);
      return;
    }
  } catch {}

  // AI failed or returned low confidence — still notify with original (low-confidence) result
  await notifySmsExpense(message, parsed);
}

export async function scanExistingSms(quiet: boolean = false): Promise<number> {
  if (Platform.OS !== 'android') return 0;

  if (!isSmsModuleAvailable()) {
    if (!quiet) {
      Alert.alert(
        'Development Build Required',
        'SMS scanning requires a development build (expo prebuild).\n\nRun: npx expo prebuild\nThen rebuild the app to enable SMS reading.'
      );
    }
    return 0;
  }

  if (scannedHistorical) {
    scannedHistorical = false;
  }

  const granted = await requestSmsPermissions();
  if (!granted) {
    if (!quiet) {
      Alert.alert(
        'SMS Permission Denied',
        'SMS access is required to auto-detect expenses from bank messages. You can grant it in Settings > Apps > Meridian > Permissions.'
      );
    }
    return 0;
  }

  const messages = await readExistingSms(200);
  let count = 0;

  processSmsBatch(messages, async (payload: SmsNotificationPayload) => {
    await handleSmsMatch(payload);
    count++;
  });

  scannedHistorical = true;
  return count;
}
