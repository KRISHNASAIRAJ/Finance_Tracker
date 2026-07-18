import { Platform, Alert } from 'react-native';
import { readExistingSms, processSmsBatch, startSmsListener, requestSmsPermissions, isSmsModuleAvailable } from './smsReader';
import { notifySmsExpense, setupNotificationTapHandler } from './smsNotificationHandler';
import type { SmsNotificationPayload } from './smsReader';

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
    await notifySmsExpense(payload.message, payload.parsed);
  });
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
    await notifySmsExpense(payload.message, payload.parsed);
    count++;
  });

  scannedHistorical = true;
  return count;
}
