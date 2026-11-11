# Meridian — Feature Implementation Plan

> Status: DONE (implemented on v4)
> Branch: v4

---

## 1. ✅ Nutrition Trend — Month Selector

**Problem:** The nutrition trend graph only shows 7D and the current month (30D).
Last month's data is invisible.

**Files:** `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`

**Changes:**
- Add `graphMonth` state (`YYYY-MM`, defaults to current month).
- In month mode, show `‹ Jun 2026 ›` arrows to navigate months + a label.
- `monthOverview` becomes a function of `graphMonth` — builds days from the 1st to
  the last day of that month. Current month caps at today; past months show full month.
- Derive navigable months from existing `entries`.
- Added a month picker bottom sheet (tap the month label).

---

## 2. ✅ Quick Meals (from Recipes Library)

**Problem:** Every meal must be typed manually or photo-analyzed. No one-tap presets.

**Plan:**
- Sourced from the **Recipes Library** (`usePersonalStore.recipes`) instead of a
  separate saved-meals concept.
- `QuickMealsScreen` lists recipes — tap → confirmation modal with meal type
  picker, editable macros (cal/protein/carbs/fat), and optional "Estimate macros
  with AI" button.
- Entry point: "Quick Meals" tile in the LOG MEAL bottom sheet.

**Files:**
- `mobile/src/modules/meals/screens/QuickMealsScreen.tsx` (new)
- `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`
- `mobile/src/navigation/RootNavigator.tsx`

---

## 3. ✅ Meal Chat — Add/Delete/Modify with Confirmation

**Problem:** No way to tell the AI to change existing logged meals.

**Plan:**
- New `MealChatScreen` with chat UI + quick prompts + proposed changes card.
- Edge Function `ai-meal-log` extended with `manageMode` — receives today's full
  log context + user request, returns structured `proposedChanges` (add/delete/modify).
- Show a **review card** with all proposed changes. **Confirm** applies all via
  store (addEntry/editEntry/deleteEntry); Discard cancels.
- Entry point: "Meal Chat" tile in the LOG MEAL bottom sheet.

**Files:**
- `supabase/functions/ai-meal-log/index.ts` (manage mode added, deployed)
- `mobile/src/services/aiServices.ts` (analyzeMealManage)
- `mobile/src/modules/meals/screens/MealChatScreen.tsx` (new)
- `mobile/src/modules/meals/screens/MealLoggerScreen.tsx`

---

## 4. ✅ Net Worth + Loans Card in Wealth

**Problem:** Wealth shows only portfolio value; loans exist in the store but are
invisible. Net worth (investments − loans) is not shown.

**Plan:**
- **Net Worth** added as the 4th meta row item in the hero card.
- **Loans card** below the hero: each loan as a row (name + amount + edit/delete),
  with total-loans and net worth summary.
- `LoansManagerScreen` (new) for add/edit/delete loans.
- Registered in `InvestmentsStackParamList` + navigator.

**Files:**
- `mobile/src/modules/equity/screens/InvestmentsDashboardScreen.tsx`
- `mobile/src/modules/equity/screens/LoansManagerScreen.tsx` (new)
- `mobile/src/navigation/RootNavigator.tsx`

---

## 5. 🔲 Habit Tracker (Planned)

**Problem:** No habit tracking (daily streaks, consistency) — useful for building
healthy routines that complement the diet/exercise plan.

**Design:** Glassy dark card UI (white/black glass, same colour coding as the
rest of the app).

**Screens:**
- `HabitsDashboardScreen` — list of habits with today's checkboxes, weekly
  streak view, and a summary card at top (total streaks, completion rate).
- `AddEditHabitScreen` — name, frequency (daily/weekly), optional reminder time,
  optional linked meal type (e.g. "Take protein shake" → auto-log a quick meal).
- Each habit: `id`, `name`, `frequency`, `reminderTime`, `linkedMealId`,
  `createdAt`.
- Check-ins: `habit_logs` table (date, habit_id, completed bool).
- Glass card design: semi-transparent dark surface with subtle border, accent
  colour for the streak indicator, white text for the habit name.

**Data:**
- Local store (zustand persisted) + optional Supabase sync via `habit_logs` table.
- No new migration needed initially — store locally only.

**Files:**
- `mobile/src/modules/habits/` (new module)
- `mobile/src/modules/habits/store.ts`
- `mobile/src/modules/habits/screens/HabitsDashboardScreen.tsx`
- `mobile/src/modules/habits/screens/AddEditHabitScreen.tsx`
- `mobile/src/navigation/RootNavigator.tsx` (add to MoreStack)

---

## 6. ✅ Sidebar + MoreMenu Polish

- Sidebar trigger visible on all 4 tab home screens (not on MoreStack).
- Hydration-aware gating: no 5s delay on app launch.
- Gradient trigger pill with indigo→teal glow.
- MoreMenu sections now have staggered fade/slide entrance animation on focus.
- Redundant "Cloud Synced" / "Sync Now" tiles removed (card covers them).
- Section label renamed to "ACCOUNT" with just Sign In / Logout grid.

## 7. ✅ Sync Hardening

- `FIELD_ALIASES` extended to cover ALL enqueued entities (loans, notes, goals,
  recipes, diet_plans, fuel_fills, maintenance_logs, vehicles, meal_logs,
  weight_logs, career_events, weekly_diary).
- `ON_CONFLICT_TARGET` per-entity for vehicles (user_id+name) and user_settings
  (user_id).
- `expected_incomes.id` migrated from UUID to TEXT (migration 0032).
- `category_budgets` table repair migration (0033 — table was missing).
- Edge function `ai-meal-log` deployed with manage mode.

## 8. ✅ Sleep Tracker (v4)

- **Startup crash fix (regression from 2370e6a):** `DrawerMenu` used
  `useNavigationState` outside any navigator — throws in React Navigation v7.
  Extracted shared `navigationRef` (`src/navigation/navigationRef.ts`); DrawerMenu
  now subscribes via `navigationRef.addListener('state')` with poll fallback.
  App.tsx re-exports the shared ref.
- **Schema:** migration `0037_sleep_logs.sql` — sleep_logs (start/end timestamptz,
  quality 1–5, interruptions, source manual/auto) + RLS + realtime publication.
- **Mobile module** (`src/modules/sleep/`): Zustand store (weightStore pattern,
  offline-first via sync queue; reminderTime local-only), Dashboard with one-tap
  bed/wake session (survives app kill via AsyncStorage), manual log/edit modal
  with strict time parsing (rejects rolled-over dates like Feb 31), 7-night
  duration chart, AI insight card, bedtime reminder quick-select (10:30/11/11:30
  PM + Off), `sleep-reminders` notification channel, wired into MoreStack +
  MoreMenu + deep links.
- **Usage-access auto-detect (Digital Wellbeing-style):** native
  `SleepDetectModule` (Kotlin, UsageStatsManager — passive query on screen open,
  zero battery) + `PACKAGE_USAGE_STATS` manifest permission + guarded JS bridge
  (never throws; hides card when unavailable). Morning "Detected last night"
  card with Save/Dismiss.
- **AI:** `ai-sleep-insight` edge function (Groq gpt-oss-120b, 20/day limit,
  caller-supplied nights, no medical advice) + mobile + web UI.
- **Web mirror:** `/sleep` page (TrendLine chart, CRUD table, AI insight),
  sidebar/topbar/AppShell routes, realtime sync via existing all-tables channel.
- **Tests:** mobile 40/40 (store CRUD, duration helpers, strict date parsing,
  detect-wrapper graceful degradation, app-boot e2e); web 17/17 + build green.
---

## 9. Habit Tracker + New Home + Career Goals (v4)

- **New primary Home tab** (`src/modules/home/screens/MainHomeScreen.tsx`):
  daily quote (deterministic IST day rotation), habit progress bar + quick
  tick dots with streak badges, 2 stress-release techniques (left-nostril &
  belly breathing), 6 growth principles. Finance dashboard is now the second
  tab ("Finance"); Home is first in tab bar + drawer.
- **Sidebar fix (regression):** hamburger trigger no longer depends on
  navigation-state listener timing at cold start. Each tab dashboard renders
  its own `DrawerTrigger` (shared component) � deterministic visibility.
  DrawerMenu keeps the left-edge swipe strip; active-route tracking now maps
  MainHome/FinanceHome separately.
- **Habit Tracker module** (`src/modules/habits/`): 10 canonical habits
  (sleep 6�7h, cook meals, fruit, no junk, 3L water, sleep by 11, chia seeds,
  learn 1 topic, read 1 page, plan tomorrow), Notion-style tick boxes, daily
  completion %, 10-segment progress blocks, per-habit streaks (?? at 3+),
  monthly overview grid (day columns � habit rows) with month average and
  month navigation. Offline-first store (one row per day, deterministic ids,
  upsert on user_id+log_date) via central sync queue.
- **Schema:** migration `0038_habit_logs.sql` � habit_logs (user_id, log_date
  IST day, habits JSON, notes) UNIQUE(user_id, log_date) + RLS + realtime.
- **Career Goals screen** (`src/modules/habits/screens/CareerGoalsScreen.tsx`):
  2025?2031 roadmap timeline (net worth ?80.7K ? ?12L, equity/MF portfolio
  targets per year, Project 2029 Phase M, Project Green 2 acres, Mission
  Hometown Base) with focus-year banner.
- **9 AM morning brief notification:** next 7 days scheduled in the
  `morning-brief` channel � today's quote + habits nudge, deep-links to Home.
- **Drawer:** new entries � Habit Tracker, Sleep Tracker, Career Goals;
  Home + Finance both in the primary row.
- **Web mirror:** `/habits` (tick boxes + monthly grid) and `/career/goals`
  pages, HomePage hero (quote + habit progress + stress + principles), habit
  hooks (upsert on user_id,log_date), sidebar entries, realtime auto-covers
  habit_logs via the schema-wide channel.
- **IST day math fixed:** istDayKey/dayOfYearIST now use pure UTC+5:30 offset
  math (correct from any runtime timezone � device or CI runner).
- **Tests:** mobile 70/70 (habits utils, store toggle semantics, dailyContent
  determinism, boot e2e); web 17/17, lint/typecheck/build green.

---

## 10. Home v2 + Telos Sidebar + Apple Notes + Web Ship-List (v4)

- **Home screen v2:** sleep info card (last night + 7-night avg + nights
  count, deep-links to Sleep Tracker), AI finance commentary card
  (Groq `ai-finance-comment` edge fn � 20/day cap, caller-supplied month
  spend context incl. category breakdown, top day, biggest txn, last-month
  delta; 6h client cache + manual refresh), growth principles now an
  auto-rotating side-by-side carousel (5s, fade+slide, dot indicators),
  stress techniques side-by-side.
- **Sidebar redesign (Telos-inspired):** warm aurora gradient panel, habit
  progress ring in header (% of 10 habits today), "bricks of progress" strip
  ("build your city, one brick at a time"), SPACES/TOOLBELT/SYSTEM sections,
  per-row gradient accent bars, footer brand bar.
- **Apple-Notes-style Notes (mobile + web):** folders view (All iCloud /
  custom / Notes / Recently Deleted with counts), pinned notes float to top,
  full-screen editor with autosave on back (no Save button), live search,
  move-to-folder, Recently Deleted with Recover / Delete forever,
  long-press folder rename. Migration 0039 adds notes.folder/pinned/deleted_at.
- **Web ship-list (20 items):** custom 404, per-page meta title/description/
  OG/Twitter via SEO component + canonical, favicon set + apple-touch-icon,
  robots.txt (auth content noindex, public pages allowed), sitemap.xml,
  Open Graph image (SVG), cookie banner (no tracking cookies policy),
  privacy-safe local analytics (localStorage page-view counter), sticky
  mobile CTA (post-login hidden), Thank You page, Privacy Policy, Terms,
  Contact page (validated form + mailto, no backend endpoint), mobile
  breakpoints (sidebar hidden < lg, responsive paddings), loading states
  (Skeletons) + form error states throughout.
- **Verification:** mobile 70/70 tests, tsc clean, eslint 0 errors; web
  typecheck/lint/17 tests/build green; migrations 0038+0039 pushed;
  ai-finance-comment deployed.

---

## 11. Rework + Sidebar + Notification Dupes + Fixed Expenses 2027 + Share Sheet + Receive Flow (v4)

> **Status:** 11b–11h shipped in `e5ee575`. 11a partially shipped
> (`docs/db-schema.md` 0044 entry + offers store tests); equity NaN-guard,
> loans ± adjust and seed-v4 tests still pending.

### 11a. Rework the last 11 commits (2026-10-17) properly
- **PLAN.md backfill:** document the 11 shipped commits (offers module
  mobile + web mirror + `0043_offers.sql`, equity NaN-guards +
  `0044_holdings_missing_sync_count.sql`, loans ± adjust, drawer trim to
  meals/sleep/buylist/notes/offers, dinner slot 21:30→20:30) as feature-log
  entries — currently PLAN.md ends at §10 with none of them.
- **docs/db-schema.md:** add `missing_sync_count` (0044) — holdings.sync
  ops that returned "not found" get counted so silent sync drops surface
  in UI; also verify the offers table block matches 0043 exactly.
- **Missing tests:** offers module (store create/delete + FIELD_ALIASES
  sync-queue mapping + expiry reminder refresh), equity NaN guards
  (malformed price rows must not NaN the dashboard), loans ± adjust math,
  fixed-expense seed v4 (see 11d).
- **`transactions` spine check:** offers are non-spend annotations (no
  transactions write) — document that decision in ARCHITECTURE.md.

### 11b. Sidebar (drawer) redesign — direction TBD, options
- Current: Telos-style aurora panel, habit ring header, bricks strip,
  5 tool rows + Settings/Logout — **no primary tabs in the drawer at all**
  (ACTIVE_MAP exists but Home/Finance/Garage/Tasks/Wealth are missing).
- Option A (recommended): fold.money/web-Sidebar style flat nav — all
  modules in one list (Home, Finance, Garage, Tasks, Wealth, Meals, Sleep,
  Career, Diary, Buy List, Offers, Notes) + Settings/Logout footer, active
  pill, no gradient bricks. Matches the web AppShell 1:1.
- Option B: keep Telos aurora shell but add a SPACES section with the 5
  primary tabs above TOOLBELT.
- Decision needed from user before implementing.

### 11c. Notifications pop twice 5–7 min apart
- **Root-cause analysis:** system reminder fires at slot time
  (e.g. "Breakfast Time" 9:00) AND `dietNotifications.
  checkMealReminderNotifications` adds an in-app "Missed Breakfast" at
  slot+5 min (9:00→9:05, 14:15→14:20, 18:30→18:35, 20:30→20:35) — the
  5-minute offset matches the reported 5–7 min gap exactly.
- **Fixes:**
  1. Gate the missed-meal nudge behind the new meal-reminder toggle (11e)
     and push its threshold from slot+5 → slot+45 min so it can never
     feel like a duplicate pop of the scheduled reminder.
  2. `scheduleAllReminders`: add a 45s single-flight cooldown (skip if a
     run completed <45s ago) in addition to the `isScheduling` guard.
  3. Add `dedupKey` to every `scheduleLocal` call that lacks one
     (card 2d/due/overdue×4/AMC×3, fixed-expense dues, receivables,
     wallet, buy/grocery lists) so any re-run can't stack copies.
  4. Drop redundant mount-time triggers: remove `scheduleAllReminders()`
     from FinanceHomeScreen + TasksDashboardScreen mounts and
     `scheduleMealReminders()` from MealLoggerScreen focus — keep App.tsx
     boot + explicit change points (task add/edit/delete, sleep reminder
     change, meal toggle change).
  5. Unify `MEAL_SLOTS` into one shared constant (export from
     notificationService, import in dietNotifications) to end the
     keep-in-sync comment drift.

### 11d. Fixed expenses — 2027 changes (one-time seed v4, `seedFixedExpenseFixesV4`)
- Keep: Rent ₹10,400 (1st), Electricity Bill ₹500 (1st), Parag Parikh
  Flexi Cap (1st, amount unchanged).
- Change effective 2027-01-01: HDFC Mid Cap → ₹500 and HDFC Small Cap →
  ₹500 (amounts stored in paise = 50000). Implemented as an
  effective-dated boot rule: seed writes a pending rule
  (`meridian-fixed-expense-schedule-v4` in AsyncStorage with
  effective_date=2027-01-01); on every app boot, if today ≥ effective date
  and the rule is pending, set the scheduled amounts + clear flag. UI
  shows a "changes on 1 Jan 2027" hint on affected rows until applied.
- Scheduled rule (2027-01-01): HDFC Mid Cap → ₹500 (50000), HDFC Small Cap
  → ₹500 (50000), Motilal Oswal Green ₹500 → ₹1,000 (100000) —
  Motilal row is matched/created now at its current ₹500. (The planned
  "changes on 1 Jan 2027" row hint was dropped on user request — the
  schedule applies silently at boot.)
- Add: Invesco Flexi Cap SIP ₹1,000/month (100000 paise), billingDay 1,
  category Investments, added now but due reminders suppressed until
  2027-01 (lastPaidMonth pre-set to 2026-12; dueDate 2027-01-01) so it
  "starts from Jan 1st".
- Remove: Emergency Fund SIP (₹120, last-day) — delete the row now and
  enqueue the cloud delete (fixed_expenses sync).
- ORDER in FixedExpensesScreen gains 'invesco' before 'midcap'.

### 11e. Meal-logging reminder toggle inside Meal Logger
- New persisted `mealRemindersEnabled` (default ON) in the meal store
  (AsyncStorage-persisted, syncs nothing new).
- Toggle UI: switch row in MealLoggerScreen header ("Meal reminders").
- scheduleAllReminders skips all 4 meal slots when OFF; the missed-meal
  nudge (11c) is also gated by it. Toggling calls scheduleAllReminders
  once (cancel-all + reschedule without meal slots).

### 11f. Lent & Borrow — native share sheet instead of clipboard copy
- Replace `Clipboard.setStringAsync` in copyGroupDetails (LentBorrowedScreen)
  with React Native `Share.share({ message })` — the Android share sheet
  offers WhatsApp, Instagram, Telegram, etc. Keep clipboard as a silent
  fallback only if the share sheet is unavailable. Web mirror
  (LentBorrowedPage) keeps its copy button (navigator.clipboard) since the
  web has no share sheet everywhere.

### 11g. Receive flow for the Lent & Borrowed feature (default button on expansion)
- **Every lent entry card** (LentBorrowedScreen receivables) shows a
  "Receive" button when the card is expanded.
- Tap → modal: enter amount received (₹, integers in paise).
- On confirm, walk that borrower's/group's outstanding lent entries
  ascending by date: fully-covered entries get removed; the first
  partially-covered entry is reduced by the remainder; the screen then
  shows remaining entries with adjusted amounts.
- **Log:** each receive is appended to a receive log (amount, date, per-
  entry breakdown) persisted in an AsyncStorage-backed store; NOT shown
  inline — accessible via a "Log" option inside the Receive modal. The
  receive write also goes through the existing sync queue so the adjusted
  lent entries stay consistent with the cloud.
- Scope confirmed by user: applies ONLY to the Lent & Borrowed feature
  (not general expense transactions).

### 11h. Credit card pay — allow ₹0 when due is ₹0 + auto-roll due date
- Bug: when a card's remaining due is ₹0, the Pay sheet rejects entering 0
  ("invalid") so the user can never clear/confirm a paid-off bill.
- Fix: allow 0 as a valid payment amount. When the remaining due reaches 0
  (payment applied or 0 submitted on an already-clear bill), advance the
  card's billing/due date to the same day next month so the cycle keeps
  moving without a stale overdue state.

### Verification checklist
- mobile: npm run typecheck, npm run lint, npm test (new tests green),
  npm run android manual pass: drawer nav, one reminder per slot, Receive
  flow end-to-end, share sheet, toggle.
- web: typecheck/lint/test/build (LentBorrowedPage + OffersPage untouched
  behavior).
- Migration: none required (no new tables; fixed-expense changes go
  through the existing sync queue upsert/delete).

## 12. Backfill — 2026-10-17 batch (v4)

Feature-log entries for the 11 commits shipped on 2026-10-17 (PLAN.md was
quiet during that batch; recorded here chronologically).

- **8afc650 fix(sync):** serialize sync-queue `enqueue` calls and await the
  in-flight flush when a garage pull finishes — two writers can no longer
  interleave on the queue file, and the last mutation is never left
  unflushed.
- **8272751 feat(garage):** new fuel-fill form defaults the price to the
  vehicle's last fill price (still editable), removing the most common
  retype.
- **b4f707b feat(sleep):** live-ticking Bedtime home-screen widget showing
  the elapsed session; a session whose bedtime passed while the device was
  off is treated as lost so the widget never shows a runaway "hours
  asleep" value.
- **f05f4e7 fix(tasks):** completing a task cancels its due-time reminder
  instead of letting it fire for a finished task.
- **1e844a9 fix(meals):** dinner slot moved 21:30 → 20:30 and morning-brief
  re-timed to de-stagger from nearby reminders; `cancelAll` hardened so a
  partial cancel failure cannot strand duplicate reminders.
- **a3e18e4 + dac889e feat/fix(notifications):** weekly podcast reminder
  (Fridays 8 PM IST) was added and then removed after reconsideration;
  both shipped and recorded for completeness.
- **926fba7 feat(wealth):** Loans screen gains quick +/− outstanding
  adjust buttons (`adjustLoanAmount`, clamped at 0) for part-payments and
  top-ups without opening the edit form.
- **a5f2cba feat(offers):** Offers module (mobile + web mirror +
  `0043_offers.sql`) — coupon codes, merchant discounts and expiry
  reminders via the shared reminder scheduler; non-spend annotations (no
  `transactions` write — documented in ARCHITECTURE.md §3.1).
- **9c9a8b0 refactor(nav):** drawer trimmed to the five most-used tools
  (later superseded by the flat-nav drawer in §11b, `e5ee575`).
- **9a21698 fix(equity):** two-strike Kite sync reconciliation — sync ops
  that cannot find their holding twice get reconciled instead of retrying
  forever, plus NaN guards so malformed rows cannot poison the dashboard;
  new `holdings.missing_sync_count` column
  (`0044_holdings_missing_sync_count.sql`).

## 13. Compact Stats Widget (v4)

The home-screen "Report" quick-action tile (static icon + label, tap →
combined report) becomes a live compact-stats widget.

- **Layout:** dark glass panel (same `widget_background`), title row
  `TODAY · NOV 11`, then a 2×2 stat grid — SPEND (₹, pink), TASKS LEFT
  (count or green ✓, blue), HABITS (done/total, green), SLEEP (last
  session, purple). `res/layout/widget_stats.xml`; resizable 4×2-ish
  (`minWidth 180dp`), provider meta renamed `res/xml/widget_stats.xml`,
  label "Stats", preview keeps the report icon drawable.
- **Data flow:** JS `services/statsWidget.ts` — `computeDailyStats`
  (pure, tested) reads the finance/tasks/habits/sleep stores:
  spend = today's outflow types (`expense`, `fixed_expense`,
  `fuel_purchase`, `vehicle_service`) in paise; tasksLeft = open tasks
  due today or overdue (IST day keys); habits = today's ticked vs
  `effectiveHabits().length`; sleep = latest session duration. Snapshot
  JSON → `NativeModules.StatsWidgetBridge.setStats` → SharedPreferences
  (`meridian_stats_widget`) → native redraw (same pattern as the Bedtime
  widget).
- **Native:** `widgets/StatsWidget.kt` (parses JSON with org.json,
  formats ₹ spend as `₹845`/`₹1.2k` and sleep as `7h 20m`, tasks 0 →
  green "✓"; placeholders `—` when data is missing; tap deep link
  `meridian://combined-report` unchanged), `StatsWidgetBridgeModule`,
  `StatsWidgetPackage` registered in MainApplication; the old
  `CombinedReportWidget` class and its provider xml are removed
  (manifest receiver → `.widgets.StatsWidget`).
- **Refresh:** App.tsx boot + after every foreground sync completes.
  Missing rows degrade to `—` — never blocks on app state.
- **Tests:** `services/__tests__/statsWidget.test.ts` (5) — outflow-only
  spend in paise, malformed-row resilience, IST task filter, habit/sleep
  selection, empty-state.
