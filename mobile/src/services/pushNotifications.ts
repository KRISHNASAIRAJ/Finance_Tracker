import { isExpoGo } from '../shared/isExpoGo';

let Notifications: any = null;
let _pushToken: string | null = null;

async function getNotifications() {
  if (Notifications) return Notifications;
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return Notifications;
  } catch {
    return null;
  }
}

export async function registerPushToken(userId: string, supabase: any) {
  try {
    if (isExpoGo()) return null;

    const N = await getNotifications();
    if (!N) return null;

    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await N.requestPermissionsAsync();
      if (newStatus !== 'granted') return null;
    }

    const tokenData = await N.getExpoPushTokenAsync();
    const token = tokenData.data as string;
    if (!token || token === _pushToken) return token;

    _pushToken = token;

    await supabase
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, platform: 'android', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );

    return token;
  } catch {
    return null;
  }
}

export function getPushToken(): string | null {
  return _pushToken;
}

export function setupNotificationHandler(onTap?: () => void) {
  if (isExpoGo()) return;

  getNotifications().then((N) => {
    if (!N) return;
    N.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === 'PORTFOLIO_REPORT' && onTap) {
        onTap();
      }
    });
  });
}
