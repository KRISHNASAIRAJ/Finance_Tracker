# ADR-004: Offline-First with SQLite Queue + WorkManager
## Status: Accepted · Date: 2026-07-17

## Context
The app must handle finance and task entries without internet connectivity. Manual CRUD (add expense, log fuel fill, create task) should never fail due to network unavailability.

## Decision
**SQLite local database + optimistic UI updates + sync queue processed by WorkManager.**

## Pattern

```
User taps "Add Expense"
    ↓
Write to SQLite immediately (assigned a local UUID)
    ↓ 
Zustand store updates (UI reflects change instantly)
    ↓
Add to sync_queue table: {operation: 'CREATE', table: 'transactions', payload: {...}}
    ↓
WorkManager PeriodicWork (60-min intervals, KEEP policy) processes queue
    ↓
On success: mark queue item as synced, update local record with server UUID
    ↓
On conflict: server response wins, re-sync local record
```

## Libraries
- `op-sqlite` or `expo-sqlite` for SQLite
- `@react-native-community/netinfo` for connectivity detection
- Android WorkManager via `react-native-background-fetch` or native module

## Consequences
- Every create/update operation needs both a local SQLite write and an API call path
- Conflict resolution strategy: "server wins" for data consistency
- Local UUIDs become server UUIDs after first sync — navigation must handle this
- Offline delete: queue the delete, soft-hide from UI, server confirms on next sync
