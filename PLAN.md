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
