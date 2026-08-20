import { registerRootComponent } from 'expo';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── Boot error capture ────────────────────────────────────────────────
// Release builds swallow JS errors → blank screen. Catch any startup or
// render error and show it on screen so crashes are visible & diagnosable.

let bootError: Error | null = null;

function captureError(e: unknown) {
  bootError = e instanceof Error ? e : new Error(String(e));
}

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((e: Error, isFatal?: boolean) => {
    captureError(e);
  });
}

let AppModule: React.ComponentType<any> | null = null;
try {
  AppModule = require('./App').default;
} catch (e) {
  captureError(e);
  AppModule = null;
}

function BootErrorScreen({ error }: { error: Error }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Meridian — Startup Error</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.message}>{error.message || 'Unknown error'}</Text>
        <Text style={styles.stack}>{error.stack || '(no stack)'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

class BootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }

  componentDidCatch(e: Error) {
    captureError(e);
  }

  render() {
    if (this.state.error) {
      return <BootErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

function Root() {
  if (bootError || !AppModule) {
    return <BootErrorScreen error={bootError ?? new Error('App failed to load')} />;
  }
  const AppComponent = AppModule;
  return (
    <BootErrorBoundary>
      <AppComponent />
    </BootErrorBoundary>
  );
}

registerRootComponent(Root);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#090D14',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A222F',
  },
  headerText: {
    color: '#FF887D',
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    padding: 20,
  },
  message: {
    color: '#F4F7FB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
    lineHeight: 20,
  },
  stack: {
    color: '#8894A8',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
});
