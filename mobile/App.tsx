/**
 * App — Root component: providers, background task registration, notification setup, and navigation.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox, Linking } from 'react-native';
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

LogBox.ignoreLogs([
  /expo-notifications.*removed from Expo Go/,
]);

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
        if (url.includes('add-expense')) {
          nav.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'AddExpense' } });
        } else if (url.includes('add-fuel')) {
          nav.navigate('MainTabs', { screen: 'GarageTab', params: { screen: 'AddFuelFill' } });
        } else if (url.includes('add-task')) {
          nav.navigate('MainTabs', { screen: 'TasksTab', params: { screen: 'AddEditTask' } });
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
        } else if (url.includes('bedtime')) {
          // Bedtime widget finished a session — hand start/end to the sleep store.
          // Also navigate to SleepTracker so the user sees their session. The
          // dashboard's mount effect will adopt the same start from
          // SharedPreferences (via the BedtimeWidgetBridge) for the
          // "Good morning" tap-to-confirm flow.
          const q = url.split('?')[1] ?? '';
          const params = Object.fromEntries(
            q.split('&')
              .filter((p) => p.includes('='))
              .map((p) => p.split('='))
          );
          const start = Number(params.start);
          const end = Number(params.end);
          if (Number.isFinite(start) && start > 0 && Number.isFinite(end) && end > start) {
            (async () => {
              try {
                const { supabase } = require('./src/services/supabaseClient');
                const { useSleepStore } = require('./src/modules/sleep/store');
                const { setWidgetBedtimeStart } = require('./src/modules/sleep/bedtimeWidget');
                const { data: { session } } = await supabase.auth.getSession();
                useSleepStore.getState().addEntry(
                  {
                    startTime: new Date(start).toISOString(),
                    endTime: new Date(end).toISOString(),
                    quality: null,
                    mood: null,
                    interruptions: 0,
                    notes: 'Logged from Bedtime widget',
                    source: 'manual',
                  },
                  session?.user?.id
                );
                // Clear the widget's pending start so the dashboard's mount
                // effect doesn't re-adopt it and the user doesn't get a
                // duplicate "Good morning" tap that logs a second entry.
                await setWidgetBedtimeStart(null);
              } catch (e) {
                // Don't block navigation on store errors — the dashboard's
                // mount effect will still pick up the pending start from
                // SharedPreferences via the native bridge.
                console.warn('[App] bedtime deep-link addEntry failed:', e);
              }
            })();
          }
          nav.navigate('MoreStack', { screen: 'SleepTracker' });
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
    const statsRetry = setTimeout(() => pushStatsWidget(), 2500);

    // Market data watchdog — one notification per day if Kite/NAV data has
    // not synced since the previous trading day (never on Sat/Sun).
    runMarketSyncWatchdog().catch(() => {});

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        processSyncQueue()
          .then(() => pushStatsWidget())
          .catch((e) => console.warn('[App] foreground sync failed:', e));
        runMarketSyncWatchdog().catch(() => {});
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
