import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { startSyncService, stopSyncService, performSync } from './syncService';
import { colors } from '../shared/theme/colors';

interface SyncState {
  isSyncing: boolean;
  lastSync: string | null;
  isOnline: boolean;
}

export const SyncContext = React.createContext<SyncState>({
  isSyncing: false,
  lastSync: null,
  isOnline: true,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    isOnline: true,
  });
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Initial sync on app start
    performSync().then((result) => {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSync: result.success ? new Date().toISOString() : prev.lastSync,
      }));
    });

    // Start periodic sync (every 1 hour)
    startSyncService();

    return () => {
      stopSyncService();
    };
  }, []);

  return (
    <SyncContext.Provider value={state}>
      {children}
    </SyncContext.Provider>
  );
}
