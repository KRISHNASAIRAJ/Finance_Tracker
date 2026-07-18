import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationTheme } from './src/shared/theme/colors';
import { SyncProvider } from './src/services/SyncProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <SyncProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </SyncProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
