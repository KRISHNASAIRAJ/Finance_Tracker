/**
 * App — Root component: providers, background task registration, notification setup, and navigation.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox, Linking } from 'react-native';
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
import { setupNotificationHandler } from './src/services/pushNotifications';
import { AuthProvider } from './src/services/AuthProvider';
import { registerSyncTask } from './src/services/syncScheduler';
import { processSyncQueue } from './src/services/syncQueue';
import { promptBatteryOptimization } from './src/services/batteryOptimization';
import { seedGarageData } from './src/modules/garage/store';
import { seedFixedExpenseFixes, seedCardAmcFixes } from './src/modules/finance/store';

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
    seedGarageData();
    seedFixedExpenseFixes();
    seedCardAmcFixes();
    requestNotificationPermission().then(() => {
      scheduleAllReminders();
      setTimeout(() => promptBatteryOptimization(), 3000);
    });

    setupNotificationHandler((data: Record<string, string>) => {
      const tryNavigate = () => {
        if (!navigationRef.isReady()) {
          setTimeout(tryNavigate, 300);
          return;
        }
        const nav = navigationRef as any;

if (data.screen === 'TaskDetail' && data.taskId) {
            nav.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'TaskDetail', params: { taskId: data.taskId } } });
          } else if (data.screen === 'LentBorrowed') {
            nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'LentBorrowed' } });
          } else if (data.screen === 'MealLogger') {
            nav.navigate('MainTabs', { screen: 'MoreTab', params: { screen: 'MealLogger' } });
          } else if (data.screen === 'AllMaintenance') {
            nav.navigate('MainTabs', { screen: 'GarageTab', params: { screen: 'AllMaintenance' } });
          } else if (data.type === 'PORTFOLIO_REPORT') {
          nav.navigate('MainTabs', { screen: 'InvestmentsTab' });
        }
      };
      tryNavigate();
    });

    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      if (!navigationRef.isReady()) return;

      const nav = navigationRef as any;
      if (url.includes('add-expense')) {
        nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'AddExpense' } });
      } else if (url.includes('add-fuel')) {
        nav.navigate('MainTabs', { screen: 'GarageTab', params: { screen: 'AddFuelFill' } });
      } else if (url.includes('add-task')) {
        nav.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'AddEditTask' } });
      } else if (url.includes('combined-report')) {
        nav.navigate('MainTabs', { screen: 'MoreTab', params: { screen: 'CombinedReport' } });
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        processSyncQueue().catch((e) => console.warn('[App] foreground sync failed:', e));
      }
      if (nextState === 'background') {
        processSyncQueue().catch((e) => console.warn('[App] background sync failed:', e));
      }
      appState.current = nextState;
    });

    return () => {
      subscription.remove();
      linkSub.remove();
    };
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
