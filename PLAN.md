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

## 17. Wallets section (Balance Summary) (v4)

- **New entity `wallets`** (migration `0046_wallets.sql`): `id`, `user_id`,
  `name`, `amount` (paise) + RLS ("User owns wallets") and realtime
  publication, so mobile and web mirror each other instantly.
- **Store:** finance store gains `wallets`, `seedWallets()` (idempotent),
  `setWalletAmount()` (never negative / non-finite) and `deleteWallet()`;
  edits go through the central sync queue (`wallets` entity) and the cloud
  pull merges them like every other entity.
- **Wallets section** in the Balance Summary, directly under **Bank
  Balances** (mobile + web): one row per wallet with its balance, a
  section total, and an inline editor (tap a row on mobile → modal; blur a
  field on web) to set the balance.
- **Standard providers** seeded on first open (stable ids so balances
  follow the row across devices): Amazon Pay, PayPal, PhonePe, Airtel
  Thanks, Zepto, Blinkit, BigBasket — editable in
  `WALLET_PROVIDERS` (mobile `modules/finance/store.ts`, web
  `hooks/data/useWallets.ts`).
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
