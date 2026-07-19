import { Platform, NativeModules, NativeEventEmitter, PermissionsAndroid, Alert } from 'react-native';
import { parseSms, isBankSender, isFinancialSms, shouldNotify, SmsParseResult } from './smsParser';
import { useFinanceStore } from '../modules/finance/store';

function isSuppressedSender(senderId: string): boolean {
  const suppressed = (useFinanceStore.getState() as any).suppressedSenders || [];
  return suppressed.includes(senderId.toUpperCase());
}

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
}

export interface SmsNotificationPayload {
  message: SmsMessage;
  parsed: SmsParseResult;
}

let smsModule: any = null;
let emitter: NativeEventEmitter | null = null;
let moduleChecked = false;
let moduleAvailable = false;

function getSmsModule() {
  if (Platform.OS !== 'android') return null;
  if (moduleChecked) return moduleAvailable ? smsModule : null;
  moduleChecked = true;
  try {
    smsModule = NativeModules.SmsNative;
    if (smsModule) {
      emitter = new NativeEventEmitter(smsModule);
      moduleAvailable = true;
    }
  } catch {}
  return moduleAvailable ? smsModule : null;
}

export function isSmsModuleAvailable(): boolean {
  return getSmsModule() !== null;
}

export async function requestSmsPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const readResult = await PermissionsAndroid.request(
      'android.permission.READ_SMS' as any,
      {
        title: 'Read SMS Permission',
        message:
          'Meridian needs SMS access to auto-detect expenses from bank transaction messages (HDFC, ICICI, SBI, Axis, etc.). Your messages never leave your device.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    if (readResult !== 'granted') return false;

    const receiveResult = await PermissionsAndroid.request(
      'android.permission.RECEIVE_SMS' as any,
      {
        title: 'Receive SMS Permission',
        message: 'Allow Meridian to detect new bank SMS messages as they arrive so you never miss an expense.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    return receiveResult === 'granted';
  } catch (err) {
    return false;
  }
}

export async function readExistingSms(maxCount: number = 200): Promise<SmsMessage[]> {
  const mod = getSmsModule();
  if (!mod) return [];

  try {
    const messages = await mod.readSms(maxCount);
    return (messages || []) as SmsMessage[];
  } catch {
    return [];
  }
}

export function processSmsBatch(
  messages: SmsMessage[],
  onMatch: (payload: SmsNotificationPayload) => void
): void {
  for (const msg of messages) {
    if (!isBankSender(msg.address)) continue;
    if (isSuppressedSender(msg.address)) continue;
    if (!isFinancialSms(msg.body)) continue;

    const parsed = parseSms(msg.body);
    if (!parsed) continue;
    if (!shouldNotify(parsed)) continue;

    onMatch({ message: msg, parsed });
  }
}

export function startSmsListener(onSmsReceived: (payload: SmsNotificationPayload) => void): () => void {
  const mod = getSmsModule();
  if (!mod || !emitter) return () => {};

  let sub: any = null;

  try {
    mod.startListening();
    sub = emitter.addListener('onSmsReceived', (msg: SmsMessage) => {
      if (!isBankSender(msg.address)) return;
      if (isSuppressedSender(msg.address)) return;
      if (!isFinancialSms(msg.body)) return;

      const parsed = parseSms(msg.body);
      if (!parsed) return;
      if (!shouldNotify(parsed)) return;

      onSmsReceived({ message: msg, parsed });
    });
  } catch {}

  return () => {
    if (sub) sub.remove();
    try { mod.stopListening(); } catch {}
  };
}
