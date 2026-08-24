# Meridian Web — Implementation Patterns (for AI agents)

This file is the reference for building pages in `web/`. Read it fully before writing any page.

## Stack

- Vite + React 19 + TypeScript, React Router v7, TanStack Query v5, Tailwind v4, Recharts.
- All money is stored in **paise (integers)** — display divides by 100. Never floats.

## Design language (fold.money-inspired dark dashboard)

- Background `#000000` (bg-black), cards `#101010` (bg-[#101010]) with `border border-white/10`, radius `rounded-2xl`.
- Text: `text-white` primary, `text-white/50` secondary, `text-white/30` muted.
- Semantic colors: positive/success `#59D6C7`, negative/error `#FF887D`, primary accent `#9BA5FF`, accent `#BCE85D`, warn `#E2A45C`.
- Data readouts: `tnum` class (tabular numbers), bold, `tracking-tight`.
- Pages are wrapped in a root div with `className="fade-up space-y-5"`.
- Header: `PageHeader` (title + subtitle + action). Buttons: `Button` from ui/Button.
- Cards: `Card` + optional `CardHeader`/`CardBody` from ui/Card.
- Money formatting: `paiseToRupees(paise)` → `₹1,234`, `paiseToRupeesCompact(paise)` → `₹1.2L`, `paiseToRupeesDetailed(paise)` → `₹1,234.00` from lib/format.
- Dates: `formatDate(iso)`, `formatDateTime(iso)` from lib/format; `toInputDate(iso)`/`fromInputDate(str)` from lib/istDate.
- Toasts: `toast.success(msg)` / `toast.error(msg)` from components/ui/Toast.
- Category icons/colors: `getCategoryIcon(name)` (returns a Lucide component) + `getCategory(name).color` from lib/categoryMap.
- Modal: `Modal` (open/onClose/title/footer, `wide` prop) and `ConfirmDialog` (open/onClose/onConfirm/title/message) from components/ui/Modal.
- Form fields: `Field.Input`, `Field.Textarea`, `Field.Select` (options prop) from components/ui/Field.
- Loading: `Skeleton` (className), `LoadingSpinner`, `EmptyState` (icon/title/subtitle/action) from components/ui/Shared.
- Charts: `TrendArea` (data: {label,value}[], color, height, formatter), `TrendBars`, `Donut` (data: {name,value,color}[]), `TrendLine` from components/charts/Charts.

## Data access

- `const { user } = useAuth()` → `userId = user?.id ?? ''` (from hooks/useAuth).
- Every page gets its data with a TanStack Query hook from `hooks/data/` — NEVER call supabase directly in pages.
- The pattern for forms: keep local state, on submit call `mutation.mutateAsync(...)`, `toast.success(...)`, `navigate(...)`; wrap in try/catch with `toast.error`.
- Query hooks are auto-invalidated by mutations, so lists update automatically.

### Available hooks (hooks/data/*)

| Hook file | Exports |
|---|---|
| useTransactions.ts | useTransactions(userId), useCreateTransaction(userId), useUpdateTransaction(userId) (→ mutates `{ id?, row }`), useDeleteTransaction(userId), usePayCardBill(userId) |
| useBankAccounts.ts | useBankAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount |
| useCreditCards.ts | useCreditCards, useCreateCard, useUpdateCard, useDeleteCard |
| useReceivables.ts | useReceivables, useCreateReceivable, useUpdateReceivable, useDeleteReceivable, useMarkReceivablePaid |
| useFixedExpenses.ts | useFixedExpenses, useCreateFixedExpense, useUpdateFixedExpense, useDeleteFixedExpense |
| useMisc.ts | usePayzappLoads, useCreatePayzappLoad, useDeletePayzappLoad, useExpectedIncomes, useUpsertExpectedIncome, useDeleteExpectedIncome, useUserSettings, useSetMonthlyBudget, usePortfolioActionPlan, useSavePortfolioActionPlan |
| useGarage.ts | useVehicles, useUpsertVehicle, useDeleteVehicle, useFuelFills, useUpsertFuelFill, useDeleteFuelFill, useMaintenanceLogs, useUpsertMaintenance, useDeleteMaintenance |
| useTasks.ts | useTasks, useCreateTask(userId) (input {title,description?,priority,dueDate,subtasks:string[],recurrence}), useUpdateTask (input {id,title,description?,priority,dueDate,subtasks:Subtask[],recurrence}), useDeleteTask, useToggleTask (task), useToggleSubtask ({task,subtaskId}), usePurgeOldTasks |
| useInvestments.ts | useHoldings, useCreateHolding, useUpdateHolding, useDeleteHolding, useInvestmentGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, usePortfolioSnapshots, useDeleteSnapshot, useRefreshPrices |
| usePersonal.ts | useGoals2026, useUpsertGoal2026, useDeleteGoal2026, useNotes, useUpsertNote, useDeleteNote, useRecipes, useUpsertRecipe, useDeleteRecipe, useDietPlans, useUpdateDietPlan({day,mealType,mealName}), useMealLogs, useUpsertMealLog, useDeleteMealLog, useWeightLogs, useUpsertWeight, useDeleteWeight, useCareerEvents, useUpsertCareerEvent, useDeleteCareerEvent, useDiaryEntries, useUpsertDiaryEntry, useDeleteDiaryEntry |
| useAI.ts | useAskCardTnC, usePortfolioRecommend, useAnalyzeMealText, useMealSuggest, useDailyReport |

### Types (src/types/index.ts)

- Transaction: { id, user_id, type: TxnType, amount, currency, date, category, notes?, source, payment_mode?, linked_card_id? }
- CreditCard: { id, user_id, name, network, ending_with, billing_day, balance, due_date, bank?, card_limit?, current_outstanding?, bill_amount?, paid_amount?, annual_charge?, annual_charge_date?, is_ltf? }
- BankAccount: { id, user_id, title, amount }
- Receivable: { id, user_id, person_name, amount, due_date, note?, type: 'lent'|'borrowed', status?, paid_amount? }
- FixedExpense: { id, user_id, name, amount, billing_day, category, last_paid_month?, due_date }
- Vehicle: { id, user_id, name, make?, model?, year? }
- FuelFill: { id, user_id, vehicle (name), date, amount, liters, price_per_liter, odometer, station?, note? }
- MaintenanceLog: { id, user_id, vehicle, date, amount, service_type, odometer?, notes? }
- Task: { id, user_id, title, description?, priority, due_date?, is_completed, completed_at?, subtasks?, recurrence? }
- Holding: { id, user_id, symbol, fund_name?, type, quantity, avg_buy_price, current_price?, current_value?, prev_close?, source, folio_number?, amc?, scheme_code?, isin?, sip_amount?, sip_day?, allocation_category? }
- InvestmentGoal: { id, user_id, goal_name, target_amount, target_date?, current_progress, priority?, notes? }
- PortfolioSnapshot: { id, user_id, date, total_value, day_change?, day_change_pct?, allocation_json? }
- Goal2026: { id, user_id, title, is_completed }
- Note: { id, user_id, title, content? }
- Recipe: { id, user_id, title, prep_time?, calories?, ingredients? (JSON string), steps? (JSON string) }
- DietPlanEntry rows: { id, day, meal_type, meal_name }
- MealLogEntry: { id, user_id, date, meal_type, items: MealFoodItem[], notes? } — items is JSON string in DB, parse before render
- WeightEntry: { id, user_id, date, weight_kg, notes? }
- CareerEvent: { id, user_id, name, date, type: 'up'|'down'|'balance', notes? }
- DiaryEntry: { id, user_id, week_year, week_number, content }

## Conventions

- Component file name: PascalCase.tsx. Page files can export multiple related pages (e.g. list + form) to keep file count manageable.
- No comments unless asked. Keep pages visually consistent with existing ones (copy spacing/styling patterns from an existing page).
- All mutations must use the provided hooks — never import supabase directly in pages.
