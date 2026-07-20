# Notification Flows
## Personal Tracker App · Krishna's Tracker

> Maps every notification type to its trigger, mechanism, and implementation notes.  
> **Rule**: Every notification here must survive app kill/reboot on Android.

---

## Notification Types Overview

| ID | Name | Trigger | Mechanism | Privacy Level |
|---|---|---|---|
| N1 | Task Reminder | User-set reminder time | Local (AlarmManager) | Private — never via FCM |
| N3 | Daily Portfolio Report | 8:30 PM IST daily | FCM Push (server cron) | Low-sensitivity summary only |
| N4 | Fixed Expense Due | N days before due date | Local (WorkManager daily check) | Private |
| N5 | Credit Card Due | N days before due date | Local (WorkManager daily check) | Private |

---

## N1: Task Reminder

### Trigger
User sets one or more reminder times on a task (e.g., "Remind me at 9:00 AM on 2026-07-20").

### Flow
```
User saves task with reminder
    ↓
Backend stores reminder in task_reminders table
    ↓ (or client-side for offline tasks)
Mobile: schedule @notifee AlarmManager exact alarm for remind_at timestamp
    ↓
At remind_at: AlarmManager fires → @notifee shows notification
    ↓
Notification payload:
  title: "Reminder: <task_name>"
  body: "<due_date_display>" (if set)
  data: { type: "TASK_REMINDER", task_id: "<uuid>" }
    ↓
User taps → navigate to task detail screen
```

### Implementation Notes
- Use `@notifee/react-native` with `TriggerType.TIMESTAMP`
- Requires `USE_EXACT_ALARM` permission (`android.permission.SCHEDULE_EXACT_ALARM`) — declare in `AndroidManifest.xml`
- For recurring tasks: reschedule the next alarm immediately when marking the current task complete
- On app restart (device reboot): re-schedule all pending reminders from `task_reminders` table where `notified = false` and `remind_at > now()`

### Permissions Required
```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

---

## N3: Daily Portfolio Report (8:30 PM IST)

### Trigger
Server-side cron job runs at 15:00 UTC (= 8:30 PM IST) every day.

### Flow
```
Cron job at 15:00 UTC
    ↓
FastAPI job: fetch all holdings from DB
    ↓
Compute: total_value, day_change, day_change_pct
    ↓
Optional: compute goal progress for each investment_goal
    ↓
Build FCM payload:
  notification:
    title: "📊 Portfolio Update"
    body: "₹<total> · <+/-><pct>% today"
  data:
    { type: "PORTFOLIO_REPORT", date: "2026-07-17" }
    ↓
Send FCM push to user's device token
    ↓
User taps → navigate to Portfolio Dashboard screen
```

### FCM Payload Rules (SAFETY)
- **DO NOT** include exact portfolio value in the notification body on devices with lock screen preview enabled — use percentage change instead
- FCM payload body: `"₹<rounded_lakhs>L · +1.2% today"` (no account-level detail)
- Full report is loaded when user taps and opens the app

### Implementation Notes
- Backend: use APScheduler or a cron-compatible task scheduler
- Store FCM device token on login; update on each app foreground resume
- Handle FCM token refresh: app must send new token to backend on `onTokenRefresh`
- If FCM delivery fails: silent retry by APScheduler for up to 3 attempts (5-min intervals)
- On device: FCM notification remains in tray until dismissed — do not auto-clear

### No Permission Required for Receiving FCM
(FCM is push — device token-based, not permission-gated)

---

## N4: Fixed Expense Due Reminder

### Trigger
WorkManager daily job checks each active fixed expense's next due date.

### Flow
```
WorkManager PeriodicWork (runs daily at ~9:00 AM)
    ↓
Load all active fixed_expenses from SQLite
    ↓
For each expense:
  compute next_due_date
  if next_due_date is within reminder_days_before days from today:
    check: has notification for this expense+due_date already been shown?
    No → show local notification + mark as shown in SQLite
    ↓
Notification:
  title: "Bill Due: <expense_name>"
  body: "₹<amount> due in <N> days"
  data: { type: "FIXED_EXPENSE_DUE", expense_id: "<uuid>" }
```

### Implementation Notes
- Use `@notifee` scheduled notification with `TriggerType.TIMESTAMP` for same-day reminders
- For multi-day reminders: WorkManager runs daily and fires notification when `days_until_due <= reminder_days_before`
- Deduplication: store `shown_notification_id` in SQLite per expense+cycle to prevent duplicate notifications

---

## N5: Credit Card Bill Due Reminder

### Trigger
Same pattern as N4 but driven by credit card billing cycle and due date.

### Flow
```
WorkManager PeriodicWork (runs daily at ~9:00 AM)
    ↓
Load all credit_cards from SQLite
    ↓
For each card:
  compute: next_due_date = next billing_cycle_close + due_date_offset
  if due_date within 7 days (and 3 days):
    show notification if not already shown for this cycle
    ↓
Notification:
  title: "💳 Card Bill Due: <card_name>"
  body: "Outstanding: ₹<amount> · Due <date>"
  data: { type: "CARD_DUE", card_id: "<uuid>" }
```

---

## Notification Channel Configuration

```typescript
// @notifee channel setup — call on app startup
await notifee.createChannels([
  {
    id: 'task_reminders',
    name: 'Task Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  },
  {
    id: 'portfolio',
    name: 'Portfolio Updates',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  },
  {
    id: 'bills_due',
    name: 'Bills & Due Dates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  },
]);
```

---

## OEM Battery Optimization Prompt

On first app launch (or when a notification misses), detect if battery optimization is enabled for the app:

```typescript
// Prompt user to whitelist the app from battery optimization
import { NativeModules, Platform } from 'react-native';

async function promptBatteryOptimizationIfNeeded() {
  if (Platform.OS !== 'android') return;
  const isIgnoring = await NativeModules.BatteryOptimization.isIgnoringBatteryOptimizations();
  if (!isIgnoring) {
    // Show modal explaining why whitelist is needed
    // Then open: Settings > Apps > Krishna's Tracker > Battery > Unrestricted
    NativeModules.BatteryOptimization.requestIgnoreBatteryOptimizations();
  }
}
```

Target OEMs known to aggressively kill background processes: Xiaomi (MIUI), Realme, Oppo, Vivo, OnePlus.
