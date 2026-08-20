/**
 * batteryOptimization — Prompts user to disable battery optimization for reliable background notifications.
 */
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_PROMPT_KEY = 'meridian_battery_opt_prompted';

export async function promptBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const prompted = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
    if (prompted === 'true') return;
  } catch {
    // Storage unavailable — continue with the prompt
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IntentLauncher = require('expo-intent-launcher');
    Alert.alert(
      'Keep Notifications Reliable',
      'Android may stop background notifications to save battery. Open battery settings and set this app to "Unrestricted" to ensure reminders work on time.',
      [
        { text: 'Skip', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: async () => {
            try {
              await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS
              );
            } catch {
              // Fallback to app settings
              Linking.openSettings();
            }
          },
        },
      ]
    );
  } catch {
    // If expo-intent-launcher not available, use Linking
    Alert.alert(
      'Battery Optimization',
      'For reliable notifications, please whitelist this app from battery optimization in: Settings > Apps > Meridian > Battery > Unrestricted',
      [{ text: 'OK' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
    );
  }

  try {
    await AsyncStorage.setItem(BATTERY_PROMPT_KEY, 'true');
  } catch {
    // Non-fatal — prompt may show again next launch
  }
}
