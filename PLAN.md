# Meridian — Feature Implementation Plan

> Status: DONE (implemented on v4)
> Branch: v4

---

## 0. ✅ TODO — sleep, wallets and widgets (v4, this batch)

**Done in this batch**

- [x] **Wallets are their own section** in the Balance Summary (mobile + web) and
      live in the same section as the bank accounts on the Bank Accounts screen
      (mobile + web). Wallet balances count towards the liquid balance **and**
      the net worth.
- [x] **Shared wallet editor** (`WalletBalanceEditor`) used by both mobile screens.
- [x] **Drawer cleanup** — Habits / Finance / Garage / Tasks / Wealth removed
      from the drawer (they are in the bottom tab bar).
- [x] **Sleep screen re-layout** — "LAST NIGHT" on top, the automatic tracking
      card next, "Going to bed" below it, a compact history with a
      **View all (n)** button and a new **All Sleep Logs** page.
- [x] **One-tap "Log last night"** (the habit-style action for the previous
      night only, using the user's own 7-night average and a 7:00 AM wake time).
- [x] **Notch-style sleep notification** — the detected night shows as a brief
      heads-up banner (`sleep-detected` channel, silent, `setTimeoutAfter`).
- [x] **Pillow-friendly motion detection** — the native tracker counts the
      *sustained* movement seconds of every minute, so a bump under the pillow
      is not a wake-up. **Medium sensitivity is the right setting for a phone
      under a pillow.**
- [x] **Interruption rules** — a gap of up to 5 min is a normal interruption
      (a quick phone check), a gap of 5–10 min is asked about in the morning
      ("long interruption or did your sleep end there?" + how long were you
      up), a gap of more than 10 min ends the night there.
- [x] **5-star rating** for the last night.
- [x] **Widgets** — the four quick-action widgets (Add Expense / Add Fuel /
      Add Task / Bedtime) are gone; every widget is 2x2. The **Clock & Sleep**
      widget is hardened (no preview layout, no crash on render) and a new
      **sleep-only 2x2** widget shows the compact last night and refreshes
      every day at **9:00 AM**.
- [x] **"Enable morning auto-detect" removed** — the usage-access auto-detect
      (and its native module + permission) is deleted; the accelerometer
      tracker does the job.
- [x] **Live "STILL FOR"** — the tracker status is polled every 5 s (the sensor
      period) and the readout uses the native `stillSince` timestamp, so it
      follows the phone in real time.

**Left open**

- [ ] The exact error text of the widget the user saw (never received) — the
      Clock & Sleep widget was hardened blind (try/catch + a fallback view).

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

> **Status:** 11b–11h shipped in `e5ee575`. 11a shipped too —
> `docs/db-schema.md` 0044 entry, offers store tests, equity NaN-guard +
> loans ± adjust tests (`modules/equity/__tests__/store.test.ts`) and
> fixed-expense seed-v4 tests (`modules/finance/__tests__/seedV4.test.ts`).

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
combined report) becomes a 2×2 auto-scrolling stats carousel.

- **Cards (7, one visible at a time):** MONTHLY SPEND (₹, pink), CC BILLS
  (₹, amber), BANK BALANCE (₹, blue), NET LENT / NET DEBIT (₹, green when
  lent, red when net borrowed), TASKS LEFT (count, purple; green ✓ at
  zero), NET WEALTH (₹, teal), MARKET TODAY (day change ₹ + % with the
  portfolio's net value below it — green for a gain, red for a loss; the
  change % uses the same formula as the Wealth dashboard's day-change
  card: change ÷ (value − change)).
- **Auto-scroll:** the cards live in a `ViewFlipper`
  (`android:flipInterval="3000"`, `android:autoStart="true"`,
  `android:inAnimation="@anim/widget_fade_in"` /
  `android:outAnimation="@anim/widget_fade_out"`) — the launcher flips and
  fades them every 3 seconds with no timers and no battery cost, and it
  keeps running while the app is closed. `ViewFlipper` is a
  RemoteViews-supported layout, so this stays inside the widget sandbox.
  - Framework detail: AOSP `ViewFlipper` only calls `startFlipping()` from
    `onAttachedToWindow()` when `mAutoStart` is true — `flipInterval` alone
    never starts the rotation, so `android:autoStart="true"` is required.
  - The public XML attributes are `android:inAnimation` /
    `android:outAnimation` (the older `android:animation` /
    `android:animationOut` names are not public API and fail AAPT
    resource linking).
- **Tap targets:** every card has its own PendingIntent → deep link:
  `meridian://monthly-spend`, `meridian://credit-cards`,
  `meridian://bank-accounts`, `meridian://lent-borrowed`,
  `meridian://tasks`, `meridian://wealth` (all handled in App.tsx →
  FinanceTab / TasksTab / InvestmentsTab).
- **Data flow:** JS `services/statsWidget.ts` — `computeWidgetStats`
  (pure, tested) reads the finance/tasks/equity/garage stores: monthly
  spend uses **the exact rule of the in-app Monthly Spend screen**
  (transactions of type `expense`/`vehicle_service` in the current month,
  minus fixed expenses and the Rent/SIP/Investments/Housing/Wallet-Load
  categories, plus this month's garage fuel fills); cc bills = **Σ card
  balance** — the same rule as the Credit Cards screen per-card due, the
  Balance Summary card-outstanding total, the net-worth formula and the
  web Credit Cards page (`balance ?? current_outstanding`). The gross
  statement (`billAmount`) is deliberately not used because it ignores
  payments already made against the bill; bank balance = Σ accounts; net
  lent = Σ outstanding lent − Σ outstanding borrowed; tasks = open tasks
  due today or overdue; net worth = holdings + FDs − loans; market today =
  `getTodayPnL()` (holdings × (price − prev close)) with the portfolio
  value from `getPortfolioValue()`. Snapshot JSON
  → `NativeModules.StatsWidgetBridge.setStats` → SharedPreferences
  (`meridian_stats_widget`) → native redraw (same pattern as the Bedtime
  widget).
- **Refresh:** App.tsx boot (plus a 2.5s retry, because the persisted
  stores hydrate asynchronously), after every foreground sync, and when the
  app goes to the background. Missing rows degrade to `—` — never blocks
  on app state.
- **Native:** `widgets/StatsWidget.kt` (parses JSON with org.json,
  formats ₹ as `₹845`/`₹1.2k`; net lent flips label NET LENT → NET DEBIT
  and colour; tasks 0 → green "✓"; placeholders `—` when data is
  missing), `StatsWidgetBridgeModule`, `StatsWidgetPackage` registered in
  MainApplication; the old `CombinedReportWidget` class and its provider
  xml are removed (manifest receiver → `.widgets.StatsWidget`).
- **Refresh:** App.tsx boot + after every foreground sync completes.
  Missing rows degrade to `—` — never blocks on app state.
- **Tests:** `services/__tests__/statsWidget.test.ts` (9) — monthly
  outflow-only spend, malformed-row resilience, card bill fallback,
  account sums, lent/borrowed netting (incl. negative net), IST task
  filter, non-finite net worth.

## 14. Asset Allocation consistency + repo cleanup (v4)

- **Bug:** the Wealth tab's ASSET ALLOCATION donut built its legend from
  *every* holding, so a leftover row (sold out, zero quantity, malformed
  numbers) still produced a phantom slice — "Gold" / "Equity" categories
  the user does not actually hold. The web dashboard already filtered
  `value > 0`, so mobile and web disagreed (the inconsistency).
- **Fix:** one shared rule, now in `modules/equity/store.ts`:
  - `allocationCategoryOf(holding)` — an explicit category wins (trimmed
    and validated against `ALLOCATION_CATEGORIES`), otherwise the holding
    type decides (mf → Mutual Funds, etf → ETF, equity → Equity, other →
    Other). Unknown category strings are ignored instead of creating a
    bogus bucket.
  - `holdingValueOf(holding)` — value guarded against non-finite numbers.
  - `allocationBuckets(holdings)` — only holdings worth something are
    bucketed, so nothing empty can ever show up as a slice.
  - The dashboard donut, the list tabs (Equity / Mutual Funds) and the
    Portfolio Breakdown drill-down all read from these helpers, so the
    donut and the lists can never disagree. The web app mirrors the same
    rule (`allocCategoryOf` + `value > 0` filter) — one behaviour on both
    platforms.
- **Tests:** `modules/equity/__tests__/store.test.ts` — category
  fallbacks, explicit/trimmed/unknown categories, zero-value rows skipped,
  bucketing + percentages.
- **Repo cleanup:**
  - Removed 3 dead files with zero references: `shared/components/SoftScrollView.tsx`,
    `shared/components/SyncPulse.tsx`, `shared/hooks/useSpeechToText.ts`.
  - Removed the now-unused `CombinedReportWidget` (replaced by StatsWidget)
    and its provider xml.
  - Cleared 62 lint warnings across 28 files (unused imports, unused
    locals/args, empty catch blocks). CI lints the whole tree with
    `--max-warnings 80`; the repo now reports 12 warnings (all
    intentional `console` diagnostics) instead of 74.

## 22. Day change for mutual funds (v4)

The day's gain only covered equity — mutual funds never contributed because
they had no `prev_close`.

- **Root cause:** `refresh-portfolio-prices` only priced a fund when
  `holdings.scheme_code` was set. Every fund that stores its **ISIN** in
  `symbol` (with no scheme code) fell through to the Yahoo equity feed, which
  has no quote for a fund → the holding was never refreshed and never got a
  `prev_close`. Live check: 5 of 6 holdings failed, only the equity one
  updated.
- **Fix:** the edge function now resolves a fund's AMFI scheme code from the
  scheme code, the scheme name (search) **or the ISIN** — the ISIN is looked
  up in the official AMFI NAV list (`amfiindia.com/spages/NAVAll.txt`, both the
  payout and the reinvestment ISIN columns). The NAV history then comes from
  mfapi.in, where the previous entry is the previous trading day's NAV — the
  day change of a fund is NAV to NAV. The response now also reports the price
  and prev_close per holding.
- **Result (verified live):** 6/6 holdings refresh, every holding carries a
  prev_close, so the day change covers equity **and** mutual funds.
- **UI:** the Wealth dashboard's "DAY CHANGE" now shows the split
  (`Equity ±₹… · MF ±₹…`) on mobile and web — stocks and funds price on
  different clocks, so one opaque number hid the difference.
- **Tests:** `modules/equity/__tests__/store.test.ts` — the day P&L split into
  equity / mutual funds / other, and the guards for holdings without a usable
  prev_close.

## 21. Clock + Sleep home-screen widget (2x2) (v4)

A 2x2 home-screen widget that mirrors the reference design: the date
("Saturday 17"), a live clock with seconds ("09:34 53"), the last night of
sleep inside a neon-green pill and a weather line.

- **Layout:** `res/layout/widget_clock_sleep.xml` — the clock parts are
  `TextClock` views, so the widget keeps itself up to date (the seconds tick
  every second) without any periodic work. The sleep pill
  (`drawable/widget_sleep_pill.xml`) is a layer-list: a rounded body plus the
  raised "island" on the right that carries the duration ("8H 42M"). Inside it
  a dotted timeline (`widget_sleep_dots.xml`) carries the two REM windows
  (`widget_sleep_rem_bar.xml`).
- **Native:** `widgets/ClockSleepWidget.kt` (provider) +
  `ClockSleepWidgetBridgeModule.kt` / `ClockSleepWidgetPackage.kt` (JS bridge).
  The REM segments are positioned by padding a full-width progress bar, so the
  segment lands exactly on the timeline on every launcher.
- **Data:** `services/sleepWidget.ts` pushes the last night (duration, bedtime,
  wake time and the two REM windows derived from the sleep cycle) to the
  widget; the widget refreshes whenever a sleep entry is logged and on app
  foreground. The weather line is a static "19 °C" placeholder until a weather
  API is wired into the same payload.
- **Tests:** `modules/sleep/__tests__/sleepWidget.test.ts` (5) — the latest
  night is picked, the duration and both REM windows are derived correctly.

## 20. Automatic sleep tracker (accelerometer + smart alarm) (v4)

Sleep tracking that works like the "Automatic Sleep Tracker" Android apps:
the phone itself is the sensor, so **no watch is needed**. It sits *alongside*
the existing manual one-tap session and the usage-stats auto-detect.

- **Native service** (`mobile/android/.../sleep/`):
  - `SleepMotionService` — a foreground service (`specialUse` type) that
    samples the accelerometer every 5 s, all night (screen off, app closed) and
    stores one bucket per minute with the peak movement. Movement = the
    distance from 1 g plus any orientation change (picking the phone up or
    turning it over).
  - `SleepMotionStore` — SharedPreferences persistence of the config, the
    timeline (36 h retention) and the alarm state, so the tracker survives
    app kills and reboots (`SleepMotionBootReceiver`).
  - `SleepMotionConfig` — settings (sensitivity, night window, wake window,
    alarm mode, snooze). The movement thresholds are mirrored in TypeScript so
    JS and native always agree.
  - `SleepMotionModule` / `SleepMotionPackage` — the RN bridge
    (start / stop / setConfig / getStatus / getBuckets / clearBuckets /
    stopAlarm), registered in `MainApplication`.
- **Inference (TypeScript, unit tested)** —
  `modules/sleep/sleepInference.ts`: `inferSleepSession()` turns the timeline
  into a sleep session — still stretches separated by a short awake gap stay in
  one block, the block is clipped to the night window, the bedtime is the
  moment the phone was put down and the wake time the moment it was picked up
  (end of the main sleep stretch), plus the night wake-ups and a confidence
  score.
- **Smart alarm** — inside the wake window the alarm rings on the first sign of
  movement (light sleep) or at an exact time, with **Stop** and
  **Snooze N min** buttons on the notification, alarm-volume audio and
  vibration.
- **UI** (Sleep Tracker screen): "Automatic tracking" card with the on/off
  switch, live status (tracking / still for Xh Ym), sensitivity, night window
  and smart-alarm settings (time pickers), plus a "Detected automatically"
  card with Save / Dismiss. Detected sessions are saved automatically
  (toggle) as `source = 'auto-motion'`.
- **Tests:** `modules/sleep/__tests__/sleepInference.test.ts` (11) — thresholds,
  midnight-wrapping windows, a normal night, night wake-ups, sensitivity
  behaviour, the wake time at the end of the main stretch, stillness streaks.
- **Permissions:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`.

## 19. Pill Reminder with Skip / Remind-in-30-min actions (v4, not yet pushed)

A medication (pill) reminder module, opened from the More menu, whose
notification panel carries two action buttons — the way MyTherapy does it.

- **Data:** new `medications` table (migration `0048_medications.sql`:
  name, dosage, `times` JSONB of daily "HH:MM" doses, notes, active) with
  RLS + realtime. Mobile store `modules/medications/store.ts`
  (AsyncStorage-persisted, every write pushed through the sync queue) and
  `useMedicationsSync` for the cloud pull/push.
- **Screen:** More menu → **Pill Reminder** (`PillReminderScreen`): list of
  medicines with dose-time pills, pause/resume, edit, delete, "Sync from
  cloud"; add/edit modal with name, dosage, times ("08:00, 20:00") and
  notes.
- **Reminders:** `services/medicationReminders.ts` schedules one local
  notification per dose for the next 2 days (re-armed on boot and whenever a
  medicine changes). Skipped doses are not scheduled again that day
  (`skipDose`, day-scoped keys).
- **Notification actions:** a notification category `medication-reminder`
  with two buttons — **⏭ Skip** (marks the dose skipped for the day) and
  **⏰ Remind in 30 min** (re-schedules the same dose 30 minutes later).
  The category is registered in `notificationService.setupChannels`, the
  buttons work both in the foreground (`setupNotificationHandler` now
  forwards the action identifier + notification id) and with the app closed
  (background task `meridian-medication-action` registered through
  `Notifications.registerTaskAsync`).
- **Tests:** `modules/medications/__tests__/medications.test.ts` (17) —
  dose-time parsing/validation, next-occurrence maths, skip bookkeeping,
  scheduling rules (active only, skipped doses skipped, category attached)
  and both action handlers.

## 18. Credit card reward points (v4, not yet pushed)

Reward points per card, with the ₹ value derived from the card's reward
program.

- **Rules** (`modules/finance/cardRewards.ts`, mirrored in
  `web/src/lib/cardRewards.ts`): IDFC (FIRST) style cards are **4 points =
  ₹1**; **cashback cards are direct cashback (1 pt = ₹1)**; every other
  card defaults to 1 pt = ₹1. The rule is matched on the card name/bank.
- **Data:** new `credit_cards.points` column (migration
  `0047_credit_card_points.sql`, applied to the hosted project) + a
  `points` field on the mobile `CreditCard` type, the web `CreditCard`
  type, and the sync payload/pull mapping.
- **Mobile:** every card in the Credit Cards list shows its points and the
  reward value (`12,400 pts · ₹3,100 rewards`; cashback cards show
  `· ₹8,200 cashback`). The card detail screen has a **Reward Points**
  block (points, reward value, rate) with a pencil editor to set the
  points collected.
- **Web:** the card grid shows the points + reward value; the card detail
  page has a "Reward points" stat; the add/edit forms have a "Reward
  points" field with the live rate hint.
- **Tests:** `modules/finance/__tests__/cardRewards.test.ts` (8) — rule
  matching (IDFC / cashback / default / by bank), point valuation, invalid
  input handling, rounding.

## 17. Wallets section (Balance Summary) (v4)

- **New entity `wallets`** (migration `0046_wallets.sql`): `id`, `user_id`,
  `name`, `amount` (paise) + RLS ("User owns wallets") and realtime
  publication, so mobile and web mirror each other instantly.
- **Store:** finance store gains `wallets`, `seedWallets()` (idempotent),
  `setWalletAmount()` (never negative / non-finite) and `deleteWallet()`;
  edits go through the central sync queue (`wallets` entity) and the cloud
  pull merges them like every other entity.
- **Wallets live inside the Bank Balances section** — not as a separate
  section or card. The wallet rows are appended under the bank account
  rows in the same section (mobile: Balance Summary → "Bank Balances",
  which now opens expanded by default; web: the "Bank balances" card).
  Wallet balances are cash, so they count towards the section total and
  the net worth (no minimum-balance rule applies to them).
  Wallet balance is never shown as a standalone card (not on the home
  screen and not on the stats widget).
- **Standard providers** seeded on first open (stable ids so balances
  follow the row across devices): Amazon Pay, PhonePe, Zepto, Blinkit,
  BigBasket — editable in `WALLET_PROVIDERS` (mobile
  `modules/finance/store.ts`, web `hooks/data/useWallets.ts`). Rows for
  providers that leave the catalog (PayPal, Airtel Thanks) are pruned
  automatically, locally and in the cloud (`RETIRED_WALLET_IDS`).
- **Migration note:** the `wallets` table uses `gen_random_uuid()::TEXT`
  (not `uuid_generate_v4()` — the uuid-ossp extension is not enabled on
  the hosted project) and adds the table to the realtime publication in a
  best-effort block so a publication error can never block the migration.
- **Tests:** `modules/finance/__tests__/wallets.test.ts` (5) — seeding is
  idempotent, balances update in paise, negative/NaN amounts are rejected,
  deletion, and the provider list.

## 16. Notification hygiene: service spam + market-sync watchdog + MF SIP naming (v4)

- **Vehicle service reminder was spamming.** The trigger was a rolling
  "now + 60 min" with a constant dedup key (`service_<vehicle>`), so every
  app open re-armed it and a due service could notify every hour (and a
  delivered notification is no longer in the scheduled list, so the dedup
  scan could not stop it either). It now fires **once per day per vehicle**
  at 9:00 AM (today if still ahead, otherwise tomorrow) with a day-keyed
  dedup (`service_<vehicle>_<YYYY-MM-DD>`).
- **Market-sync watchdog** (`services/marketSyncWatchdog.ts`) — one
  notification per day when the market data has not synced since the
  previous trading day:
  - **Never on Saturday or Sunday** (market holidays).
  - **At most one notification per calendar day** — day-keyed dedup key plus
    a persisted "already notified" marker, so repeated app opens never
    stack copies.
  - Kite freshness uses `holdings.last_synced_at` (set by
    `kite-holdings-sync`); MF/ETF NAV freshness uses `holdings.updated_at`
    (set by `refresh-portfolio-prices`). A holding counts as fresh when it
    was synced on or after the **previous trading day** — mutual fund NAV
    for a day is published the next morning, so "today's NAV missing" is
    normal and never triggers the warning.
  - Runs on app boot and on every foreground; tapping the notification
    opens the Wealth dashboard (new `InvestmentsDashboard` tap target).
  - Holdings rows now carry `lastSyncedAt` / `updatedAt` in the mobile
    store (mapped in `useEquitySync`).
- **Mutual funds are SIPs due on the 1st**:
  - `holdingDisplayName()` appends " (SIP)" to mutual fund names in the
    holdings list, dashboard preview and portfolio breakdown (mirrored in
    the web app's holdings list).
  - `MF_SIP_DAY = 1` — the SIP day defaults to the 1st for every MF row
    (mobile pull mapping + web holding form), and migration
    `0045_mf_sip_day.sql` backfills existing MF rows to `sip_day = 1`.
- **Tests:** `services/__tests__/marketSyncWatchdog.test.ts` (11) — weekend
  skip, previous-trading-day maths, Kite/MF freshness rules, one
  notification per day; `modules/equity/__tests__/store.test.ts` — the
  " (SIP)" name rule.

## 15. Widget CC BILLS + snapshot date order (v4)
- **CC BILLS (widget):** the widget summed the gross statement
  (`billAmount`, ignoring `paidAmount`) and preferred a stale
  `currentOutstanding`, so the number did not match anything in the app.
  It now uses the app's single rule — **Σ card balance** (Credit Cards
  screen per-card due, Balance Summary card outstanding, net worth, web
  Credit Cards page). Three new tests cover balance priority, the
  partly-paid bill case and the `balance`-missing fallback.
- **Snapshot dates order:** Portfolio History's "SNAPSHOT DATES" list was
  built from the chart array (chronological, oldest first) while "View All"
  (SnapshotDates) listed newest first. The list now shows the newest dates
  first — same order as the full list — while the chart itself stays
  chronological and tapping a row still highlights the right chart point
  (the list rows carry the original chart index).

## 28. Card bill payments + cloud sync hardening (v4)

- **The web "Pay bill" left the bill standing.** It only wrote `paid_amount`
  and `current_outstanding`, so the card kept its old (past) `due_date` and its
  old `bill_amount` — the mobile app pulled that state and kept showing the
  bill as due. It now clears the card the same way the mobile app does: the
  due date rolls to the next billing day and the bill amount, the paid amount
  and the balance go back to zero. The bill payment transaction is written
  with the same shape as on mobile (`linked_card_id`, "Credit Card Bill").
- **A billing day of 31 skipped a month** — `new Date(year, month, 31)` rolls
  over to the 3rd of March. The roll is now clamped to the last day of the
  month (31 Jan → 28 Feb) in both apps (`nextCardDueDate`).
- **An UPDATE that matches no row is now an error.** PostgREST reports no
  error when an update hits 0 rows, so a payment for a card the cloud did not
  know yet was silently dropped and the next pull restored the old state. The
  sync queue now falls back to an upsert when the update hit 0 rows (the card
  writes carry the full row, so the upsert has every NOT NULL column).
- **The persist-key bump no longer wipes local data.** The finance store moved
  to `meridian-finance-storage-v15` for the `wallets` rows, but the storage
  falls back to the previous key and the migration carries the state forward —
  an app update must never throw away a local edit that has not been pushed
  yet.
- **Tests:** `services/__tests__/syncQueueCloud.test.ts` (3) — the upsert
  fallback, the normal update path and a failing write staying queued;
  `modules/finance/__tests__/cardBill.test.ts` (6) and
  `web/src/lib/__tests__/cardBill.test.ts` (5) — the due-date roll.

## 23. Sleep-only 2x2 widget + the 9:00 AM refresh (v4)

- **One sleep widget, 2x2:** the four quick-action widgets (Add Expense, Add
  Fuel, Add Task, Bedtime) are removed — the last night of sleep is what the
  home screen should carry. Every widget in the app is 2x2 now (Stats, Clock &
  Sleep, Sleep).
- **New widget** (`widgets/SleepStatsWidget.kt` +
  `res/layout/widget_sleep_stats.xml`): the compact last night — the duration,
  the bedtime → wake time, the wake-ups and the 5-star rating, with the two
  REM windows marked on the dotted timeline inside the green pill.
- **Daily refresh at 9:00 AM** (`SleepWidgetScheduler` +
  `SleepWidgetAlarmReceiver`): an inexact repeating alarm redraws the sleep
  widgets every morning (the alarm is re-armed on boot and whenever the widget
  is drawn). The data itself is pushed from JS (`services/sleepWidget.ts` →
  both widget bridges).
- **Clock & Sleep hardened:** the provider never crashes the launcher any more
  (a failed render falls back to a plain clock), and the risky
  `previewLayout` / `updatePeriodMillis` attributes are gone.
- **The real cause of "An error occurred when loading widget":** Android only
  allows the view classes annotated with `@RemoteViews.RemoteView` inside a
  widget layout — a plain `<View>` is **not** one of them, so the launcher
  refused to inflate both sleep widgets. The spacers and the timeline are
  `TextView`s now (the Stats widget never used a plain `<View>` and always
  worked).

## 24. Pillow-friendly sleep detection + the interruption rules (v4)

- **Sustained movement:** the native tracker now records, next to the peak
  movement of the minute, the number of **seconds of sustained movement**
  (`MotionBucket.movingSeconds`). A minute only counts as awake when the
  movement was sustained (20 s on medium sensitivity, 30 s on low, 12 s on
  high) — a bump of the mattress under a pillow is no longer a wake-up.
  **Medium sensitivity is the right setting for a phone under a pillow.**
- **The wake time** now follows the wake window: a movement inside the wake
  window is the wake-up, an earlier movement is a short interruption and the
  night goes on (it then lasts until the end of the wake window).
- **Interruption rules:** a gap of up to **5 minutes** is a normal interruption
  (a quick phone check counts), a gap of **5–10 minutes** is ambiguous — in
  the morning the app asks "was that a long interruption, or did your sleep
  end there?" and, for a long interruption, asks how long the user was up and
  takes that time out of the sleep. A gap of **more than 10 minutes** ends the
  night right there.
- **Tests:** `modules/sleep/__tests__/sleepInference.test.ts` (25) — the pillow
  rules, the interruption classification, the pending-gap question and both
  answers.

## 25. Sleep screen v3 (v4)

- The order is now: **LAST NIGHT** (hero) → the detected night → the
  automatic tracking card → **Going to bed** → the chart / insight / settings →
  the compact history. The line "Uses the motion sensor — no watch needed" is
  gone.
- **Compact history** (the last 5 nights, one line each) with a **View all (n)**
  button that opens the new **All Sleep Logs** page (`SleepHistoryScreen`) with
  the summary (nights, average, total), every log and the edit modal.
- **"Log last night"** — the habit-style one-tap action for the previous night
  only: the length comes from the user's own 7-night average (7 hours without
  history) and the wake time is 7:00 AM.
- **Rate your sleep out of 5** — a star row under the last night (saved on the
  entry, also shown on the sleep widget).

## 26. Wallets in their own section (v4)

- The Balance Summary now has a **Wallets** section next to the Bank Balances
  (mobile + web) and the Bank Accounts screen shows the wallets in the same
  section as the accounts (mobile + web). The wallet rows are tappable and use
  the shared `WalletBalanceEditor` (mobile).
- Wallet balances are cash: they count towards the liquid balance **and** the
  net worth (`getTotalBalance()` = accounts + wallets), and the hero card
  splits the chips into **Banks** and **Wallets**.

## 27. Drawer cleanup + auto-detect removal (v4)

- The drawer no longer repeats Habits / Finance / Garage / Tasks / Wealth —
  they are in the bottom tab bar.
- The usage-access auto-detect ("Enable morning auto-detect") is removed
  together with its native module (`SleepDetectModule`), the
  `PACKAGE_USAGE_STATS` permission and the JS bridge — the accelerometer
  tracker does the job now.

