/**
 * Jest setup — mocks native modules that are unavailable in the test env.
 * AsyncStorage is used by the Zustand persist middleware across all stores.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
