/**
 * Jest setup — mocks native modules that are unavailable in the test env.
 * AsyncStorage is used by the Zustand persist middleware across all stores.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-speech-recognition requires a native module that does not exist in Jest
jest.mock('expo-speech-recognition', () => {
  const listeners = {};
  return {
    ExpoSpeechRecognitionModule: {
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      getStateAsync: jest.fn().mockResolvedValue('idle'),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    useSpeechRecognitionEvent: jest.fn(),
    getSpeechRecognitionServices: jest.fn().mockResolvedValue([]),
    supportsOnDeviceRecognition: jest.fn().mockResolvedValue(false),
    supportsRecording: jest.fn().mockResolvedValue(false),
    androidIntentOptions: {},
  };
});
