/**
 * kwgtBridge — sends the sleep data to KWGT (the Kustom widget maker).
 *
 * A KWGT preset can receive a broadcast and read the extras, so the same
 * night the Meridian widget draws (the duration, the score, the bed and the
 * wake time, the stage bars) can be shown in a KWGT widget as well.
 *
 * The broadcast:
 *   action  com.meridian.sleep.WIDGET_DATA
 *   package org.kustom.widget
 *   extra   data — the JSON payload
 *
 * In a KWGT preset the receiver is read with `br`:
 *   $br(com.meridian.sleep.WIDGET_DATA)$
 */
import { NativeModules } from 'react-native';

const KwgtBridgeModule = NativeModules.KwgtBridge as
  | { sendSleepData: (json: string) => Promise<boolean> }
  | undefined;

/** True when the bridge is available (Android with the native module). */
export function isKwgtBridgeAvailable(): boolean {
  return !!KwgtBridgeModule;
}

/** Send the payload to KWGT. Never throws. */
export async function sendSleepDataToKwgt(payload: unknown): Promise<boolean> {
  if (!KwgtBridgeModule) return false;
  try {
    await KwgtBridgeModule.sendSleepData(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
