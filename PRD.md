# Product Requirements Document
## Meridian — Personal Life Tracker (Finance + Vehicle Garage + Task Manager + Equity/MF Tracker)

**Version:** 1.1
**Date:** September 13, 2026
**Owner:** Krishna Sai Raj Ponneboina
**Platform:** Mobile app (Android first, iOS later) + web mirror
**Intended build method:** AI coding agents (Claude Code / opencode etc.), module by module
**Design:** Dark mode first — all screens in dark. Stitch project: https://stitch.withgoogle.com/projects/4997376971246377666
**App name:** Meridian

---

## 1. Overview

**Meridian** is a single app, for personal use, that unifies daily life tracking currently scattered across spreadsheets, notes apps, and bank/broker apps:

1. **Finance Tracker** — credit cards, bank balances, lending/borrowing, fixed expenses, daily expenses, AI assistant for card T&Cs
2. **Vehicle Garage** — fuel fills, mileage, service/maintenance spend
3. **Task Manager** — Notion-style tasks with reminders and notifications
4. **Equity/MF Tracker** — holdings, Kite sync, AI rebalancing suggestions, daily 8:30 PM portfolio report
5. **Personal Notes & Goals** — 2026 life goals, notes, recipes, diet plan
6. **Meals / Career / Diary** — meal logging with AI photo analysis, career events, weekly diary

**Design principle:** Dark mode first. One shared backend (Supabase), one shared auth/session, one shared notification pipeline, modules sharing a common `transactions`-style data spine (finance, fuel, vehicle spend, portfolio all produce "money events").

---

## 2. Goals / Non-Goals

**Goals**
- Single source of truth for personal finances, vehicle costs, tasks, and investments
- Reduce manual data entry via Kite auto-sync
- Give daily visibility into net worth / portfolio without opening 5 apps
- Provide AI assistance scoped to two things: card T&C Q&A, and portfolio recommendations

**Non-Goals (v1)**
- Not a multi-user/family finance app — single user only for v1
- Not a public app store release — sideload/personal use
- Not a substitute for licensed financial advice — AI recommendations are informational only, with disclaimers
- No iOS build in phase 1 (iOS deferred)

---

## 3. Tech Stack (as built — see ADR-008)

| Layer | Choice | Notes |
|---|---|---|
| Mobile framework | React Native (Expo) | Cross-platform, Android-first rollout |
| Web mirror | Vite + React + TypeScript + Tailwind + TanStack Query | Deployed on Netlify |
| Backend | Supabase (PostgREST + Edge Functions in Deno/TS) | No custom server — cron via pg_cron, AI/Kite via edge functions |
| Database | PostgreSQL (Supabase-hosted) | RLS on all tables; migrations in `supabase/migrations/` |
| Local cache | Zustand + AsyncStorage | Offline-first with central sync queue |
| Auth | Supabase Auth (JWT) | Single login across mobile + web |
| Push notifications | Expo Push Notifications (server-triggered) | Local reminders via expo-notifications |
| Charts | react-native-svg / Recharts (web) | Donut, area, progress |
| AI | Groq API (via Supabase Edge Functions) | gpt-oss-120b/20b text, qwen3.6-27b vision — T&C RAG, portfolio recs, meal AI, daily reports |
| Brokerage data | Kite Connect (Zerodha) | Read-only holdings sync, OAuth via edge functions |
| Price feeds | Yahoo Finance + AMFI | Live quotes via refresh-portfolio-prices |
| Hosting | Supabase (DB+auth+functions) + Netlify (web) | Free tier only |

---

## 4. Shared / Cross-Cutting Systems

### 4.1 Unified transaction spine
A single `transactions` table underlies Finance, Vehicle Garage, and Equity modules:

```
transactions
- id
- type: enum [expense, credit_card_bill, lent, borrowed, fixed_expense,
              fuel_purchase, vehicle_service, portfolio_buy, portfolio_sell]
- amount
- currency
- date
- category
- linked_account_id (nullable)
- linked_card_id (nullable)
- linked_vehicle_id (nullable)
- linked_holding_id (nullable)
- source: enum [manual, kite_sync]
- notes
- created_at / updated_at
```

This lets a single query answer "total outflow this month across everything" without joining four separate schemas.

### 4.3 AI Assistant (two scoped instances)
**a) Card T&C Assistant**
- User uploads PDF/text T&C per credit card
- Backend chunks + embeds the document, stores per-card
- Chat UI scoped to one card at a time; retrieval-augmented — answers grounded only in that card's uploaded T&C
- Always show a disclaimer: "Based on the document you uploaded — verify with your bank for current terms."

**b) Portfolio Recommendation Assistant**
- Reads current holdings + allocation from DB
- Sends portfolio snapshot + basic rules (concentration %, asset class mix) to Groq API (via edge function)
- Returns plain-language suggestions (e.g., "X% concentrated in one stock — consider diversifying")
- Clearly labeled: informational only, not investment advice

### 4.4 Notifications
| Notification | Trigger | Mechanism |
|---|---|---|
| Task reminder | User-set time | Local on-device notification (expo-notifications) |
| Daily portfolio report | 8:30 PM daily | pg_cron → edge function → Expo push |
| Fixed expense due soon | N days before due date | Local scheduled notification |
| Credit card bill due | N days before due date | Local scheduled notification |
| Daily AI report | 9:30 PM / 8:30 AM IST | Edge function → Expo push |

### 4.5 Charts (used across modules)
- Line chart: spend over time, portfolio value over time, mileage trend
- Donut/pie: expense category breakdown, portfolio allocation
- Bar: card-wise outstanding, monthly fuel spend, vehicle cost breakdown (fuel vs service vs other)

---

## 5. Module 1 — Finance Tracker

### Entities
- **CreditCard**: name, bank, limit, billing_cycle_date, due_date, current_outstanding, tnc_document_id
- **BankAccount**: bank_name, nickname, account_type, current_balance, last_updated
- **LentRecord**: person_name, amount, date_lent, expected_return_date, status, notes
- **BorrowedRecord**: person_name, amount, date_borrowed, expected_repay_date, status, notes
- **FixedExpense**: name, amount, frequency, due_date, linked_account_or_card, reminder_enabled
- **Expense** (in `transactions` as type=expense): amount, category, payment_mode, date, note, linked_account/card

### Screens
1. Finance Dashboard — net worth summary, this month's spend, upcoming dues, quick charts
2. Credit Cards list → Card detail (statement history, outstanding, TnC chat button)
3. Bank Accounts list → Account detail
4. Lent/Borrowed list (combined ledger view with status filters)
5. Fixed Expenses list
6. Daily Expense quick-add (widget/FAB from dashboard)
7. Reports — category breakdown, monthly trend, card-wise outstanding

### User stories
- As a user, I can add a new credit card and see its outstanding balance and due date.
- As a user, I can log a daily expense in under 10 seconds via a quick-add FAB.
- As a user, I can upload a card's T&C and ask questions about it.
- As a user, I can see a pie chart of my spend by category for the current month.

### Acceptance criteria
- TnC assistant answers are grounded only in the uploaded document (no hallucinated fees)
- Dashboard net worth = sum(bank balances) − sum(card outstanding) − sum(borrowed) + sum(lent)

---

## 6. Module 2 — Vehicle Garage

### Entities
- **Vehicle**: name, type, registration number
- **FuelFill**: vehicle_id, odometer_reading, quantity_liters, price_per_liter, total_amount, date, station_name
- **VehicleSpend**: vehicle_id, type (service/repair/insurance/accessory/other), amount, date, odometer_reading, description

### Screens
1. Vehicle Garage Dashboard (per vehicle selector) — mileage trend, total cost of ownership this month
2. Fuel Fill log (list + add form)
3. Vehicle Spend log (list + add form, categorized)
4. Reports — mileage over time, cost per km, fuel vs service vs other breakdown

### Derived metrics
- Mileage since last fill = (current odometer − previous odometer) / quantity_liters
- Cost per km = total spend (fuel + service + other) / total km driven in period

### Acceptance criteria
- Adding a fuel fill auto-calculates and displays mileage since the previous fill
- Vehicle dashboard correctly sums fuel + service + other into "total cost of ownership"

---

## 7. Module 3 — Task Manager

### Entities
- **Task**: name, description, due_date, reminder_times (array), status, priority, tags, project/category, recurrence_rule, parent_task_id (for subtasks)

### Screens
1. Task list (filter by status/priority/tag, Notion-style grouping by project)
2. Task detail — description, subtasks/checklist, reminders
3. Add/edit task form
4. Calendar/agenda view (optional, phase 2)

### User stories
- As a user, I can create a task with a reminder and receive a push notification at that time.
- As a user, I can set a task to recur daily/weekly/monthly.
- As a user, I can break a task into subtasks/checklist items.

### Acceptance criteria
- Local notification fires within 1 minute of scheduled reminder time even if app is backgrounded/killed (requires proper Android notification scheduling, not just in-app timers)
- Recurring tasks auto-regenerate the next instance on completion

---

## 8. Module 4 — Equity/MF Tracker

### Entities
- **Holding**: symbol/fund_name, type (equity/MF), quantity, avg_buy_price, current_price, current_value, source (manual/kite_sync)
- **PortfolioSnapshot**: date, total_value, day_change, allocation_breakdown (for historical charting)
- **InvestmentGoal**: goal_name (e.g. "Retirement corpus", "House down payment", "Emergency fund top-up"), target_amount, target_date, current_progress (derived from linked holdings or manually tracked), linked_holding_ids (optional — which holdings count toward this goal), priority, notes

### Screens
1. Portfolio Dashboard — total value, day's P&L, allocation pie
2. Holdings list — per-holding P&L
3. **Goals screen** — list of investment goals with progress bars (current value vs target), target date countdown, add/edit goal form
4. AI Recommendations screen — chat/summary view, now goal-aware (see below)
5. Historical performance chart

### Integrations
- Kite Connect API or Kite MCP for auto-sync of holdings (verify current access/pricing before implementation — this is a paid API historically)
- Manual entry fallback for holdings not synced

### Scheduled job
- Daily at 8:30 PM IST: pg_cron → refresh prices (Yahoo + AMFI) → portfolio-snapshot edge function computes day summary → sends Expo push notification with a one-line summary ("Portfolio: ₹X, up 1.2% today") → tapping opens full report screen
- Report can optionally include goal progress (e.g. "Retirement goal: 34% funded, on track for 2040")

### AI recommendations — goal-aware
- When generating rebalancing/allocation suggestions, the assistant should factor in each goal's target amount, target date, and which holdings are linked to it — e.g. flagging if a short-term goal (2–3 years) is overexposed to equity, or if a long-term goal is too conservative
- Still clearly labeled: informational only, not investment advice

### Acceptance criteria
- 8:30 PM notification fires reliably every day regardless of app state
- AI recommendation output includes a visible "not financial advice" disclaimer
- Manual and Kite-synced holdings render identically in the UI
- Goal progress bar updates automatically as linked holdings' value changes

---

## 9. Module 5 — Personal Notes & Goals

### Purpose
A catch-all personal module for two related but distinct things: (1) tracking your 2026 life goals (separate from investment goals in Module 4) with a simple status workflow, and (2) a recipes/diet plan reference you can pull up day to day. Grouped together as "Personal Notes" since both are low-frequency-write, high-frequency-read content rather than transactional data.

### Entities
- **Goal2026**: title, description, category (health/career/personal/financial/other), status (`pending` / `fulfilled` / `failed`), target_date (optional), created_at, updated_at, notes/reflection (freeform, e.g. why it succeeded or failed)
- **Note**: title, body (rich text), tags, pinned (boolean), created_at, updated_at — general freeform personal notes, Notion-style
- **Recipe**: title, ingredients (list), steps (ordered list), prep_time, tags (e.g. veg/non-veg, cuisine), source/notes
- **DietPlanEntry**: day_of_week (or specific date), meal_slot (breakfast/lunch/dinner/snack), linked_recipe_id (optional) or freeform meal description, calorie_estimate (optional)

### Screens
1. **2026 Goals** — list of goals grouped by status (Pending / Fulfilled / Failed) with a simple tap-to-change-status action; add/edit goal form; optional progress notes per goal
2. **Notes** — freeform note list (search + tags + pin), add/edit note
3. **Recipes** — recipe list (searchable by tag/cuisine), recipe detail view (ingredients + steps)
4. **Diet Plan** — weekly grid (day × meal slot) referencing saved recipes or freeform entries; quick view of "what am I eating today"

### User stories
- As a user, I can list out my goals for 2026 and mark each as pending, fulfilled, or failed as the year goes on.
- As a user, I can jot down a general note without it belonging to any other module.
- As a user, I can save a recipe and later add it to a specific day/meal in my diet plan.
- As a user, I can open "today" in the diet plan and see what I planned to eat.

### Acceptance criteria
- Changing a goal's status is a single tap/action, not a full edit form
- Diet plan view defaults to showing the current day first
- Recipes linked into the diet plan display correctly even after the recipe is edited later (i.e. diet plan references the recipe, doesn't duplicate its content)

---

## 10. Non-Functional Requirements

- **Offline-first**: manual entries (expenses, fuel, tasks) must work offline and sync when connectivity returns
- **Data privacy**: Financial data stored encrypted at rest; card T&C documents and portfolio data never leave the backend except for scoped AI calls
- **Performance**: dashboard loads in under 2 seconds with local cache
- **Notification reliability**: task reminders and 8:30 PM report must survive app kill/reboot (expo-notifications local scheduling on Android — never JS timers)

---

## 11. Build Roadmap (COMPLETE — all phases shipped)

> Status as of September 2026. Actual phase log lives in `AGENTS.md` Section 3.

**Phase 0 — Foundation** ✅ Supabase schema, RLS, sync queue, edge function scaffolds
**Phase 1 — Finance Tracker core** ✅ Cards, accounts, lending, fixed expenses, budgets, PayZapp, charts
**Phase 2 — Vehicle Garage** ✅ Multi-vehicle, fuel + service logs, mileage, reminders
**Phase 3 — Task Manager** ✅ Subtasks, recurrence, notifications, buy/grocery lists
**Phase 4 — Equity/MF Tracker** ✅ Holdings, Kite sync, goals, live prices, 8:30 PM cron + Expo push, net worth + loans + FDs
**Phase 5 (SMS auto-capture)** — removed from project
**Phase 6 — AI Assistants** ✅ T&C RAG chat, goal-aware portfolio recs, meal AI, daily reports
**Phase 7 — Personal Notes & Goals** ✅ Goals, notes, recipes, diet plan
**Phase 8 — Meals / Career / Diary** ✅ Meal logger + trends + chat, career events, weekly diary
**Phase 9 — Polish** ✅ CombinedReport, offline hardening, 4 notification channels, CI
**Phase 10 — Web App** ✅ Full web mirror on Netlify

---

## 12. Open Questions / Risks

- **Kite Connect access/pricing**: confirmed and implemented (read-only holdings sync). Manual entry remains the full fallback.
- **iOS support**: iOS parity is a separate effort, deferred.
- **AI cost**: AI API calls run on Groq's generous free tier — not a concern.
- **Notification reliability on Android**: OEM battery optimization (especially on Xiaomi/Oppo/Vivo devices) can kill background schedulers — app prompts users to whitelist it.

---

## 13. How to use this PRD with AI coding agents

Work with one module per session. For each, read this PRD section plus the relevant data model (`ARCHITECTURE.md`), then scaffold the module (screens, Supabase migrations, RLS) before wiring in AI/notification features. Keep the shared foundation genuinely shared — resist building each module as an island, since the value of this app over standalone trackers is the unified data spine (section 4.1) and single dashboard. Read `AGENTS.md`, `BOUNDARIES.md`, and `SAFETY.md` before writing code.