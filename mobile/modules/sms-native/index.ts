import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  'The sms-native module is not available. Run `npx expo prebuild` to compile native modules.';

const SmsNative = Platform.OS === 'android'
  ? NativeModules.SmsNative
  : null;

if (Platform.OS === 'android' && !SmsNative) {
  console.warn(LINKING_ERROR);
}

export default SmsNative;
