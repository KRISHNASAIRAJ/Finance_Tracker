/**
 * App — Root component: providers, background task registration, notification setup, and navigation.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox, Linking, ToastAndroid } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

import RootNavigator from './src/navigation/RootNavigator';
import DrawerMenu from './src/shared/components/DrawerMenu';
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
import { pushStatsWidget } from './src/services/statsWidget';
import { runMarketSyncWatchdog } from './src/services/marketSyncWatchdog';
import { scheduleMedicationReminders, handleMedicationAction } from './src/services/medicationReminders';
import { startMotionTracking } from './src/modules/sleep/sleepMotion';
import { useSleepStore } from './src/modules/sleep/store';
import { pushSleepWidget } from './src/services/sleepWidget';
import { navigationRef } from './src/navigation/navigationRef';
import { seedGarageData } from './src/modules/garage/store';
import { seedFixedExpenseFixes, seedCardAmcFixes, applyScheduledFixedExpenseChanges } from './src/modules/finance/store';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await exportAllData();
    await cleanOldBackups(30);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Background handling for the pill-reminder notification buttons. Defined
// at module scope so it is registered even when the app is not running.
const MEDICATION_ACTION_TASK = 'meridian-medication-action';
TaskManager.defineTask(MEDICATION_ACTION_TASK, async ({ data, actionIdentifier }: any) => {
  try {
    await handleMedicationAction(actionIdentifier, data ?? {});
  } catch {
    /* best-effort */
  }
  return BackgroundFetch.BackgroundFetchResult.NoData;
});

/**
 * Refresh the weather (every four hours) and repaint the home-screen widget.
 *
 * Called when the app is opened and every time it comes back to the
 * foreground. The reading itself is reused for four hours, so this only
 * costs a request when the weather is actually stale.
 */
async function refreshWeather(): Promise<void> {
  try {
    const { getWeather } = require('./src/services/weather');
    const reading = await getWeather();
    if (!reading) return;
    await pushSleepWidget();
  } catch (_e) { /* the weather is optional — never break the app */ }
}

LogBox.ignoreLogs([
  /expo-notifications.*removed from Expo Go/,
]);

/**
 * Refresh the weather and repaint the home-screen widget.
 *
 * Called when the app is opened and every time it comes back to the
 * foreground. The reading itself is reused for three hours, so this only
 * costs a request when the weather is actually stale — and the home-screen
 * weather card then has a fresh reading waiting for it.
 */

// Shared container ref (re-exported for backwards compatibility with any
// code importing it from App).
export { navigationRef };

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    registerBackupTask();
    scheduleNextBackup();
    registerSyncTask();
    seedGarageData();
    seedFixedExpenseFixes();
    seedCardAmcFixes();
    // Applies the armed 2027-01-01 SIP amount changes on the first boot on/
    // after that date (exits immediately otherwise). The sync queue attaches
    // the session user id on flush, so no userId is needed here.
    applyScheduledFixedExpenseChanges().catch(() => {});
    requestNotificationPermission().then(() => {
      scheduleAllReminders();
      // Pill reminders are scheduled a moment later so the persisted
      // medication list has finished hydrating.
      setTimeout(() => scheduleMedicationReminders().catch(() => {}), 1500);
      setTimeout(() => promptBatteryOptimization(), 3000);
    });

    // The automatic sleep tracker only runs at night (21:30 → 09:30 by
    // default). Re-arm it whenever the app opens: during the day it just
    // schedules tonight's start, inside the window it (re)starts the
    // tracker.
    try {
      const { useSleepStore } = require('./src/modules/sleep/store');
      const { startMotionTracking, isSleepMotionAvailable } = require('./src/modules/sleep/sleepMotion');
      if (isSleepMotionAvailable()) {
        const auto = useSleepStore.getState().autoConfig;
        if (auto?.enabled) {
          setTimeout(() => startMotionTracking({ ...auto, enabled: true }).catch(() => {}), 800);
        }
      }
    } catch (_e) { /* the tracker is unavailable (iOS / Expo Go) */ }

    // The weather (the temperature in the widget) is refreshed when the app
    // is opened and every time it comes back to the foreground — the reading
    // itself is reused for four hours.
    refreshWeather();

    // Background handler for the pill-reminder action buttons.
    try {
      const Notifications = require('expo-notifications');
      if (typeof Notifications.registerTaskAsync === 'function') {
        Notifications.registerTaskAsync(MEDICATION_ACTION_TASK).catch(() => {});
      }
    } catch (_e) { /* notifications unavailable (Expo Go) */ }

    setupNotificationHandler(async (data: Record<string, string>, actionIdentifier?: string, notificationId?: string) => {
      // Pill-reminder action buttons (Skip / Remind in 30 min) are handled
      // first — they must not also trigger navigation.
      if (actionIdentifier) {
        const handled = await handleMedicationAction(actionIdentifier, data, notificationId);
        if (handled) return;
      }

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
            nav.navigate('MoreStack', { screen: 'MealLogger' });
          } else if (data.screen === 'AllMaintenance') {
            nav.navigate('MainTabs', { screen: 'GarageTab', params: { screen: 'AllMaintenance' } });
          } else if (data.screen === 'DailyReport') {
            nav.navigate('MoreStack', { screen: 'DailyReport' });
          } else if (data.screen === 'BuyList') {
            nav.navigate('MoreStack', { screen: 'BuyList' });
          } else if (data.screen === 'GroceryList') {
            nav.navigate('MoreStack', { screen: 'GroceryList' });
          } else if (data.screen === 'Offers') {
            nav.navigate('MoreStack', { screen: 'Offers' });
          } else if (data.screen === 'SleepTracker') {
            nav.navigate('MoreStack', { screen: 'SleepTracker' });
          } else if (data.screen === 'MainHome') {
            nav.navigate('MainTabs', { screen: 'HomeTab' });
          } else if (data.screen === 'HabitTracker') {
            nav.navigate('MoreStack', { screen: 'HabitTracker' });
          } else if (data.screen === 'InvestmentsDashboard') {
            nav.navigate('MainTabs', { screen: 'InvestmentsTab', params: { screen: 'InvestmentsDashboard' } });
          } else if (data.screen === 'FixedExpenses') {
            nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'FixedExpenses' } });
          } else if (data.screen === 'PillReminder') {
            nav.navigate('MoreStack', { screen: 'PillReminder' });
          } else if (data.type === 'PORTFOLIO_REPORT') {
          nav.navigate('MainTabs', { screen: 'InvestmentsTab' });
        }
      };
      tryNavigate();
    });

    const handleDeepLink = (url: string | null) => {
      if (!url) return;

      const tryRoute = (attempt = 0) => {
        if (!navigationRef.isReady()) {
          if (attempt < 10) setTimeout(() => tryRoute(attempt + 1), 200);
          return;
        }
        const nav = navigationRef as any;
        if (url.includes('task-complete')) {
          // The Stats widget's task circle: mark the task as done and go back
          // to the home screen.
          const id = url.split('task-complete/')[1]?.split('?')[0]?.trim();
          if (id) {
            try {
              const { useTasksStore } = require('./src/modules/tasks/store');
              useTasksStore.getState().toggleTaskCompleted(id);
              ToastAndroid.show('Task completed', ToastAndroid.SHORT);
            } catch (_e) { /* best-effort */ }
          }
          if (nav.canGoBack()) nav.goBack();
        } else if (url.includes('add-expense')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'AddExpense' } });
        } else if (url.includes('add-fuel')) {
          nav.navigate('MainTabs', { screen: 'GarageTab', params: { screen: 'AddFuelFill' } });
        } else if (url.includes('add-task')) {
          nav.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'AddEditTask' } });
        } else if (url.includes('task/')) {
          // The Stats widget's task name: open that task.
          const id = url.split('task/')[1]?.split('?')[0]?.trim();
          nav.navigate('MainTabs', {
            screen: 'TasksTab',
            params: { screen: 'TaskDetail', params: { taskId: id } },
          });
        } else if (url.includes('combined-report')) {
          nav.navigate('MoreStack', { screen: 'CombinedReport' });
        } else if (url.includes('monthly-spend')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'MonthlySpend' } });
        } else if (url.includes('credit-cards')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'CreditCards' } });
        } else if (url.includes('bank-accounts')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'BankAccounts' } });
        } else if (url.includes('lent-borrowed')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'LentBorrowed' } });
        } else if (url.includes('tasks')) {
          nav.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'TasksDashboard' } });
        } else if (url.includes('wealth')) {
          nav.navigate('MainTabs', { screen: 'InvestmentsTab', params: { screen: 'InvestmentsDashboard' } });
        } else if (url.includes('sleep')) {
          // Clock + Sleep / Sleep home-screen widgets
          nav.navigate('MoreStack', { screen: 'SleepTracker' });
        } else if (url.includes('people')) {
          // The daily "keep in touch" digest
          nav.navigate('MoreStack', { screen: 'People' });
        } else if (url.includes('home')) {
          // The stats widget's long press
          nav.navigate('MainTabs', { screen: 'HomeTab' });
        }
      };
      tryRoute();
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // Compact home-screen stats widget — refresh on boot and after every
    // foreground sync completes (best-effort; no-ops on iOS/Expo Go).
    // Stores hydrate asynchronously from AsyncStorage, so push once now and
    // again shortly after the persisted state has been restored.
    pushStatsWidget();
    pushSleepWidget();
    const statsRetry = setTimeout(() => {
      pushStatsWidget();
      pushSleepWidget();
    }, 2500);

    // Market data watchdog — one notification per day if Kite/NAV data has
    // not synced since the previous trading day (never on Sat/Sun).
    runMarketSyncWatchdog().catch(() => {});

    // Automatic sleep tracking — re-arm the native tracker when the user has
    // it enabled. The persisted config hydrates a moment after boot, so this
    // runs a little later.
    setTimeout(() => {
      try {
        const cfg = useSleepStore.getState().autoConfig;
        if (cfg?.enabled) startMotionTracking(cfg);
      } catch (_e) { /* best-effort */ }
    }, 2500);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        processSyncQueue()
          .then(() => pushStatsWidget())
          .catch((e) => console.warn('[App] foreground sync failed:', e));
        runMarketSyncWatchdog().catch(() => {});
        // The weather is refreshed every time the app comes back.
        refreshWeather().catch(() => {});
      }
      if (nextState === 'background') {
        processSyncQueue()
          .then(() => pushStatsWidget())
          .catch((e) => console.warn('[App] background sync failed:', e));
      }
      appState.current = nextState;
    });

    return () => {
      clearTimeout(statsRetry);
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
            <DrawerMenu />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthGate>
    </AuthProvider>
  );
}
