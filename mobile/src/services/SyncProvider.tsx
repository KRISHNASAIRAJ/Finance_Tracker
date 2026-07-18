import React, { useEffect, useRef, useState } from 'react';
import { startSyncService, stopSyncService, performSync } from './syncService';

interface SyncState {
  isSyncing: boolean;
  lastSync: string | null;
}

export const SyncContext = React.createContext<SyncState>({
  isSyncing: false,
  lastSync: null,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
  });
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Silently attempt sync in background — never block UI
    performSync().catch(() => {});
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
