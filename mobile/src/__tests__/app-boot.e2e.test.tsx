/**
 * App E2E boot test — mounts the entire App (providers, auth, navigation,
 * notification scheduling, background tasks, stores) and asserts it renders
 * without crashing. Runs in CI after unit tests, before the APK build.
 */
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterAllTasksAsync: jest.fn(async () => {}),
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(async () => {}),
  BackgroundFetchResult: { NewData: 'NewData', NoData: 'NoData', Failed: 'Failed' },
  BackgroundFetchStatus: { Available: 1 },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'mock-token' })),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidNotificationPriority: { HIGH: 5, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 1 },
}));

jest.mock('expo-file-system', () => ({
  Paths: {
    document: { uri: 'file:///mock-doc' },
    library: { uri: 'file:///mock-lib' },
    cache: { uri: 'file:///mock-cache' },
  },
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    exists() { return false; }
    create() {}
    write() {}
    delete() {}
  },
  Directory: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    exists() { return false; }
    create() {}
    list() { return []; }
    delete() {}
  },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///mock-report.pdf' })),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const React = require('react');
  return {
    LinearGradient: ({ children, style }: any) =>
      React.createElement(View, { style }, children),
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

// Avoid importing the real batteryOptimization module (which accesses Platform.OS
// in a way that clashes with the RN 0.81 jest preset).
jest.mock('../services/batteryOptimization', () => ({
  promptBatteryOptimization: jest.fn(async () => {}),
}));

jest.mock('../services/supabaseClient', () => {
  const chainable = (): any => {
    const fn: any = async () => ({ data: [], error: null });
    fn.then = (cb: any) => Promise.resolve({ data: [], error: null }).then(cb);
    fn.finally = (cb: any) => Promise.resolve({ data: [], error: null }).finally(cb);
    [
      'select', 'order', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'or',
      'ilike', 'like', 'match', 'insert', 'upsert', 'update', 'delete',
      'single', 'maybeSingle', 'limit', 'returns', 'textSearch', 'not', 'is',
    ].forEach((m) => { fn[m] = chainable; });
    return fn;
  };
  return {
    supabase: {
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
        signOut: jest.fn(async () => ({ error: null })),
      },
      from: jest.fn(() => chainable()),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
      })),
    },
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import App from '../../App';

describe('App E2E — full boot', () => {
  it('mounts the entire app (providers, auth gate, navigation) without crashing', async () => {
    let tree: any = null;
    await act(async () => {
      tree = create(<App />);
    });

    expect(tree).not.toBeNull();
    expect(tree.toJSON()).not.toBeNull();

    // Unmount cleanly (no crashes in effect teardown)
    await act(async () => {
      tree.unmount();
    });
  });
});
