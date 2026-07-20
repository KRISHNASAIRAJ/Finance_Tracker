import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationTheme } from './src/shared/theme/colors';
import RestorePrompt from './src/shared/components/RestorePrompt';
import AuthGate from './src/shared/components/AuthGate';
import { exportAllData, TASK_NAME, cleanOldBackups } from './src/services/backupService';
import { scheduleNextBackup, registerBackupTask } from './src/services/backupScheduler';
import { scheduleAllReminders, requestNotificationPermission } from './src/services/notificationService';
import { AuthProvider } from './src/services/AuthProvider';
import { registerSyncTask, triggerSyncNow } from './src/services/syncScheduler';
import { processSyncQueue } from './src/services/syncQueue';
import { promptBatteryOptimization } from './src/services/batteryOptimization';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await exportAllData();
    await cleanOldBackups(30);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

LogBox.ignoreLogs([
  /expo-notifications.*removed from Expo Go/,
]);

export const navigationRef = createNavigationContainerRef();

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    registerBackupTask();
    scheduleNextBackup();
    registerSyncTask();
    requestNotificationPermission().then(() => {
      scheduleAllReminders();
      setTimeout(() => promptBatteryOptimization(), 3000);
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        processSyncQueue().catch((e) => console.warn('[App] foreground sync failed:', e));
      }
      if (nextState === 'background') {
        processSyncQueue().catch((e) => console.warn('[App] background sync failed:', e));
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <AuthGate>
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <StatusBar style="light" />
            <RestorePrompt />
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthGate>
    </AuthProvider>
  );
}
