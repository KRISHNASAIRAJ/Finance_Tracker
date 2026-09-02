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