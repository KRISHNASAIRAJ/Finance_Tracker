# Development Order — Meridian

> **Purpose:** Granular, dependency-aware sequence of features to complete in order.
> **Rule:** Complete one item entirely before moving to the next. Update this document's status after each.
> **Status Legend:** 🔴 Pending | 🟡 In Progress | 🟢 Done | ⏭️ Skipped

---

## Phase 1 — Finance Tracker Polish

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 1.1 | Backend: Add `linked_account_id` to Transaction model + migration | Backend | 🔴 | Missing from current model vs ARCHITECTURE.md spec |
| 1.2 | Backend: Add `card_limit`, `bank` fields to CreditCard model | Backend | 🔴 | Current model uses `network`/`ending_with` instead |
| 1.3 | Backend: Create `lent_borrowed` table per spec (direction, status, amount_settled) | Backend | 🔴 | Current uses simplified `Receivable` |
| 1.4 | Backend: Create Finance Summary endpoint with net worth calc | Backend | 🟢 | Done |
| 1.5 | Mobile: Wire FinanceHome to backend API (currently uses local store only) | Mobile | 🔴 | All data is hardcoded seed data |
| 1.6 | Mobile: Add expense category icons + color map shared module | Mobile | 🔴 | Currently imported from AddExpenseScreen |
| 1.7 | Mobile: Add EditTransaction screen polish (category picker, validation) | Mobile | 🔴 | Exists, may need polish |
| 1.8 | Mobile: Add Credit Card detail screen (statement history, due date, T&C link) | Mobile | 🔴 | Currently inline modal only |

## Phase 2 — Vehicle Garage Completion

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 2.1 | Backend: Create `vehicles` table per spec (name, type, reg_number) | Backend | 🔴 | Current garage has no vehicles table — uses string field |
| 2.2 | Backend: Create Vehicles CRUD router | Backend | 🔴 | |
| 2.3 | Backend: Fix mileage calculation to use vehicles FK + odometer | Backend | 🔴 | |
| 2.4 | Backend: Create Vehicle Spend reports endpoint | Backend | 🔴 | |
| 2.5 | Mobile: Wire GarageDashboard to backend API | Mobile | 🔴 | Currently local store only |
| 2.6 | Mobile: Add Vehicle Spend log screen | Mobile | 🔴 | Missing from current screens |
| 2.7 | Mobile: Add Vehicle Reports screen (mileage chart, cost breakdown) | Mobile | 🔴 | Missing from current screens |

## Phase 3 — Tasks Completion

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 3.1 | Backend: Create `task_reminders` table per spec | Backend | 🔴 | |
| 3.2 | Backend: Add recurrence_rule support to task creation | Backend | 🔴 | |
| 3.3 | Backend: Add subtask parent/child support | Backend | 🔴 | |
| 3.4 | Mobile: Wire TasksDashboard to backend API | Mobile | 🔴 | |
| 3.5 | Mobile: Add subtask checklist UI | Mobile | 🔴 | |
| 3.6 | Mobile: Add recurrence picker (daily/weekly/monthly/custom) | Mobile | 🔴 | |
| 3.7 | Mobile: Implement local notification scheduling via @notifee | Mobile | 🔴 | Task reminders |

## Phase 4 — Equity / MF Tracker

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 4.1 | Backend: Create `holdings` table model + Pydantic schemas | Backend | 🔴 | |
| 4.2 | Backend: Create Holdings CRUD router | Backend | 🔴 | Entirely missing |
| 4.3 | Backend: Create `portfolio_snapshots` table + endpoint | Backend | 🔴 | |
| 4.4 | Backend: Create `investment_goals` table + CRUD | Backend | 🔴 | |
| 4.5 | Backend: Create Portfolio Summary endpoint (total value, P&L, allocation) | Backend | 🔴 | |
| 4.6 | Mobile: Wire InvestmentsDashboard to backend API | Mobile | 🔴 | Currently local store |
| 4.7 | Mobile: Add Holdings List screen | Mobile | 🔴 | Not in current screens |
| 4.8 | Mobile: Add Investment Goals screen (with progress bars) | Mobile | 🔴 | Not in current screens |
| 4.9 | Backend: Implement 8:30 PM IST cron job for daily portfolio snapshot | Backend | 🔴 | Requires FCM push |
| 4.10 | Backend: Verify Kite Connect pricing, implement if feasible | Backend | 🔴 | Phase 5.5 — gate-check first |

## Phase 5 — SMS Auto-Capture (REMOVED)

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| — | This phase has been removed from the project | — | ⏭️ | SMS auto-capture is no longer in scope |

## Phase 6 — AI Assistants

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 6.1 | Backend: Scaffold `app/ai/` service module with Claude client | Backend | 🔴 | |
| 6.2 | Backend: Create `tnc_documents` + `tnc_embeddings` tables (pgvector) | Backend | 🔴 | |
| 6.3 | Backend: PDF upload → text extraction → chunking → embedding pipeline | Backend | 🔴 | |
| 6.4 | Backend: RAG query endpoint (embed question → cosine search → Claude) | Backend | 🔴 | |
| 6.5 | Backend: Portfolio recommendation endpoint (holdings + goals → Claude) | Backend | 🔴 | |
| 6.6 | Mobile: Card T&C upload screen + chat UI | Mobile | 🔴 | |
| 6.7 | Mobile: AI recommendations screen wiring | Mobile | 🔴 | Screen exists but needs backend |

## Phase 7 — Personal Notes & Goals

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 7.1 | Backend: Align model fields with ARCHITECTURE.md spec | Backend | 🔴 | Current models are simplified |
| 7.2 | Backend: Add rich text / Markdown body support for notes | Backend | 🔴 | |
| 7.3 | Mobile: Wire PersonalNotes to backend API | Mobile | 🔴 | |
| 7.4 | Mobile: Wire GoalsTracker to backend API | Mobile | 🔴 | |
| 7.5 | Mobile: Wire RecipesLibrary to backend API | Mobile | 🔴 | |
| 7.6 | Mobile: Wire DietPlanTracker to backend API | Mobile | 🔴 | |
| 7.7 | Mobile: Add Diet Plan "Today's view" default | Mobile | 🔴 | Screen exists, behavior check |

## Phase 9 — Cross-Cutting Polish

| # | Feature | Area | Status | Notes |
|---|---------|------|--------|-------|
| 9.1 | Backend: Add proper auth middleware (JWT validation) | Backend | 🔴 | Currently basic email-only auth |
| 9.2 | Backend: Migrate from SQLite to PostgreSQL (Supabase) | Backend | 🔴 | |
| 9.3 | Backend: Switch to async SQLAlchemy | Backend | 🔴 | Currently sync |
| 9.4 | Backend: Move business logic from routers to `services/` layer | Backend | 🔴 | Services dir is empty |
| 9.5 | Backend: Write pytest integration tests (target 60% coverage) | Backend | 🔴 | Tests dir is empty |
| 9.6 | Mobile: Add offline sync queue with WorkManager | Mobile | 🔴 | SyncProvider exists but needs WorkManager |
| 9.7 | Mobile: Add loading states, error handling, pull-to-refresh | Mobile | 🔴 | |
| 9.8 | Mobile: Notification reliability pass (WorkManager vs JS timers) | Mobile | 🔴 | |
| 9.9 | Mobile: Light mode support (apply light color tokens) | Mobile | 🔴 | Deferred per DESIGN.md |
| 9.10 | All: Final type-check + lint pass | Both | 🔴 | |

---

## Summary by Phase

| Phase | Total Items | 🟢 Done | Completion |
|-------|------------|---------|------------|
| 1 - Finance Polish | 8 | 1 | 12% |
| 2 - Garage | 7 | 0 | 0% |
| 3 - Tasks | 7 | 0 | 0% |
| 4 - Equity/MF | 10 | 0 | 0% |
| 5 - SMS Capture | 1 | 0 | Removed |
| 6 - AI Assistants | 7 | 0 | 0% |
| 7 - Personal Notes | 7 | 3 | 43% |
| 9 - Polish | 10 | 0 | 0% |
| **Total** | **55** | **5** | **9%** |

---

## Future Ideas (Not Yet Scheduled)

| Idea | Description | Dependencies |
|------|-------------|-------------|
| Personal Finance Assistant | Analyze spending patterns, lending status, net worth trends. Give recommendations on card usage, expense reduction, where to cut back. Could use Claude API via backend for analysis. | Phase 1 (Finance) stable, Phase 6 (AI) backend |
| Kite Integration | Fetch live holdings from Zerodha via Kite Connect API. Update holdings store with real prices. Daily 8:30 PM cron job to snapshot portfolio + send FCM push with summary. Goal-aware recommendations. | Verify Kite API pricing, Phase 4 (Equity) backend |
| Cross-Module Net Worth Report | Combine finance, equity, and garage spend into a unified net worth dashboard with trends. | All modules data-rich |
| Offline Sync Hardening | SQLite queue + WorkManager for reliable background sync. Conflict resolution. | Phase 9 Polish |

---

## How to Update

After completing any feature:
1. Change status from 🔴 to 🟢
2. Add completion date in Notes
3. Run `git add -A && git commit -m "<feature>: completed"`
