# Notification Flows
## Meridian · Personal Life Tracker

> Maps every notification type to its trigger, mechanism, and implementation notes.  
> **Rule**: Every notification here must survive app kill/reboot on Android.

---

## Notification Types Overview

| ID | Name | Trigger | Mechanism | Privacy Level |
|---|---|---|---|---|
| N1 | Task Reminder | User-set reminder time | expo-notifications local (scheduled) | Private — never via push |
| N2 | Diet Reminder | Diet plan schedule | expo-notifications local (scheduled) | Private |
| N3 | Daily Portfolio Snapshot | 8:30 PM IST daily | Expo push (pg_cron → portfolio-snapshot edge fn) | Low-sensitivity summary only |
| N4 | Fixed Expense Due | N days before due date | expo-notifications local | Private |
| N5 | Credit Card Due | N days before due date | expo-notifications local | Private |
| N6 | Daily AI Report | 9:30 PM / 8:30 AM IST | Expo push (ai-daily-report edge fn) | Aggregates only |

---

## N1: Task Reminder

### Trigger
User sets a reminder time on a task (e.g., "Remind me at 9:00 AM on 2026-07-20").

### Flow
```
User saves task with reminder (works offline)
    ↓
Mobile: schedule expo-notifications local notification for remind_at
    ↓
At remind_at: notification fires (survives app kill)
    ↓
Notification payload:
  title: "Reminder: <task_name>"
  body: "<due_date_display>" (if set)
  data: { type: "TASK_REMINDER", task_id: "<uuid>" }
    ↓
User taps → navigate to task screen
```

### Implementation Notes
- Use `expo-notifications` `scheduleNotificationAsync` — never `setTimeout`/`setInterval`
- For recurring tasks: reschedule the next reminder immediately when marking the current task complete
- On app restart (device reboot): re-schedule pending reminders from the tasks store where `notified = false` and `remind_at > now()`
- Buy/grocery list items follow the same pattern with their own date reminders

### Permissions Required
- `android.permission.POST_NOTIFICATIONS` (Android 13+ — runtime permission)
- Expo handles exact-alarm scheduling internally

---

## N3: Daily Portfolio Snapshot (8:30 PM IST)

### Trigger
Supabase pg_cron at 15:00 UTC (= 8:30 PM IST) every day.

### Flow
```
pg_cron job at 15:00 UTC
    ↓
refresh-portfolio-prices edge fn: fetch live quotes (Yahoo Finance + AMFI)
    ↓
portfolio-snapshot edge fn (multi-user):
  fetch holdings → compute total_value, day_change, day_change_pct
  unchanged values slide snapshot date forward (no duplicate rows)
  optional: update goal progress
    ↓
Build Expo push payload:
  title: "📊 Portfolio Update"
  body: "₹<rounded> · <+/-><pct>% today"
  data: { type: "PORTFOLIO_REPORT", date: "<yyyy-mm-dd>" }
    ↓
Send via Expo Push API to device_tokens (per user)
    ↓
User taps → navigate to Wealth dashboard
```

### Push Payload Rules (SAFETY)
- **DO NOT** include exact portfolio value in the notification body — use percentage change / rounded lakhs
- Push body: `"₹<rounded_lakhs>L · +1.2% today"` (no account-level detail)
- Full report loads when the user opens the app

### Implementation Notes
- Device Expo push tokens stored in `device_tokens` table; registered on sign-in / app foreground
- Scheduled entirely server-side (pg_cron + pg_net) — no device dependence
- Snapshots are viewable on the SnapshotDates screen

---

## N4: Fixed Expense Due Reminder

### Trigger
Client-side check on app open/focus against each active fixed expense's next due date.

### Flow
```
App open / store hydration
    ↓
Load all active fixed_expenses from store
    ↓
For each expense:
  compute next_due_date
  if next_due_date is within reminder_days_before days from today:
    check: has notification for this expense+due_date already been shown?
    No → schedule local notification + mark as shown in store
    ↓
Notification:
  title: "Bill Due: <expense_name>"
  body: "₹<amount> due in <N> days"
  data: { type: "FIXED_EXPENSE_DUE", expense_id: "<uuid>" }
```

### Implementation Notes
- Use expo-notifications local scheduling for same-day reminders
- Deduplication: persist `shown` marker per expense+cycle in the local store to prevent duplicate notifications

---

## N5: Credit Card Bill Due Reminder

### Trigger
Same pattern as N4 but driven by credit card billing cycle and due date.

### Flow
```
App open / store hydration
    ↓
Load all credit_cards
    ↓
For each card:
  compute: next_due_date = next billing_cycle_close + due_date_offset
  if due_date within 7 days (and 3 days):
    schedule notification if not already shown for this cycle
    ↓
Notification:
  title: "💳 Card Bill Due: <card_name>"
  body: "Outstanding: ₹<amount> · Due <date>"
  data: { type: "CARD_DUE", card_id: "<uuid>" }
```

---

## Notification Channel Configuration

```typescript
// expo-notifications Android channel setup — call on app startup
// 4 channels: task reminders, portfolio updates, bills/due dates, AI reports
await Notifications.setNotificationChannelAsync('task_reminders', {
  name: 'Task Reminders',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
});
// ... repeat for 'portfolio', 'bills_due', 'ai_reports'
```

---

## OEM Battery Optimization Prompt

On first app launch (or when a notification misses), detect if battery optimization is enabled for the app and prompt the user to whitelist it (unrestricted background). Target OEMs known to aggressively kill background processes: Xiaomi (MIUI), Realme, Oppo, Vivo, OnePlus.
