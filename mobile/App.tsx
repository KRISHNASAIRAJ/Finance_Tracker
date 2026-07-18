import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationTheme } from './src/shared/theme/colors';
import RestorePrompt from './src/shared/components/RestorePrompt';
import { exportAllData, TASK_NAME, cleanOldBackups } from './src/services/backupService';
import { scheduleNextBackup, registerBackupTask } from './src/services/backupScheduler';
import { scheduleAllReminders, requestNotificationPermission } from './src/services/notificationService';
import { AuthProvider } from './src/services/AuthProvider';
import { registerSyncTask, triggerSyncNow } from './src/services/syncScheduler';
import { processSyncQueue } from './src/services/syncQueue';
import { initSmsHandler, scanExistingSms } from './src/services/smsHandler';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await exportAllData();
    await cleanOldBackups(30);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const navigationRef = createNavigationContainerRef();

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    registerBackupTask();
    scheduleNextBackup();
    registerSyncTask();
    requestNotificationPermission().then(() => scheduleAllReminders());

    if (Platform.OS === 'android') {
      initSmsHandler((smsData) => {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('Finance', {
            screen: 'SmsConfirmation',
            params: { smsData },
          });
        }
      });
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        processSyncQueue();
      }
      if (nextState === 'background') {
        processSyncQueue();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar style="light" />
          <RestorePrompt />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
