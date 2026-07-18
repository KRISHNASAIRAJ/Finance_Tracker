# ADR-005: WorkManager/AlarmManager for All Notification Scheduling
## Status: Accepted · Date: 2026-07-17

## Context
Task reminders and the 8:30 PM portfolio report must fire reliably even when the app is killed. JavaScript `setTimeout`/`setInterval` die with the app process.

## Decision
**Use Android WorkManager for periodic background tasks and AlarmManager (via `@notifee`) for exact-time notifications.**

## Mechanism per Notification Type

| Type | Mechanism | Survival |
|---|---|---|
| Task reminder | AlarmManager exact alarm (`@notifee` schedules via `setAlarm`) | Survives app kill |
| SMS expense confirm | BroadcastReceiver → `@notifee` | Fires on SMS receipt |
| Daily portfolio report | FCM push from backend cron | Always-on (server-side) |
| Fixed expense due | WorkManager PeriodicWork (daily) checks due dates | KEEP policy |
| Credit card due | WorkManager PeriodicWork (daily) checks due dates | KEEP policy |

## Android OEM Battery Optimization
Many OEMs (Xiaomi MIUI, Realme, Oppo ColorOS, OnePlus) aggressively kill background processes. Mitigation:
- On first launch, detect OEM and direct user to appropriate battery settings screen
- Use `react-native-ignore-battery-optimizations` to prompt whitelist addition
- WorkManager `setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)` as fallback

## Consequences  
- Task reminders must use `USE_EXACT_ALARM` permission (requires targeting API 33+)
- FCM is preferred for the 8:30 PM report — it doesn't require the app to be alive
- Never use `setInterval` or `setTimeOut` for anything the user expects to fire reliably
