# ARCHITECTURE.md — System Architecture Document
## Meridian · Personal Life Tracker · v1.1 (ADR-008 BaaS-first)

> **Audience**: AI agents and developers implementing features.  
> **Source of truth for**: data models, system topology, integration patterns, and key design decisions.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MERIDIAN                               │
│                                                             │
│  ┌────────────────────────┐   ┌──────────────────────────┐   │
│  │  React Native App     │   │  Web App (Vite+React)    │   │
│  │  (Android, Expo)      │   │  Netlify-hosted SPA      │   │
│  │  Zustand + AsyncStorage│  │  TanStack Query + Realtime│  │
│  │  offline queue         │   │                          │   │
│  └───────────┬────────────┘   └───────────┬──────────────┘   │
│              │ Supabase JS SDK (PostgREST)│                  │
┌──────────────┼────────────────────────────┼─────────────────┐│
│              ▼                              ▼                 ││
│  ┌─────────────────────────────────────────────────────┐    ││
│  │                 SUPABASE (BaaS)                     │    ││
│  │  PostgreSQL + RLS · Auth (JWT) · Storage · Realtime │    ││
│  │  pg_cron (scheduled jobs)                          │    ││
│  └───────────────────────┬─────────────────────────────┘    ││
│                          │ pg_net                            ││
│  ┌───────────────────────▼─────────────────────────────┐    ││
│  │           Edge Functions (Deno/TypeScript)           │    ││
│  │  ai-* (Groq) · kite-* · portfolio-snapshot ·         │    ││
│  │  refresh-portfolio-prices                            │    ││
│  └─────┬──────────────┬──────────────┬──────────────────┘    ││
│        │              │              │                        ││
│  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────────┐             ││
│  │ Groq API  │  │Kite Connect│  │Yahoo/AMFI quotes│            ││
│  └───────────┘  └───────────┘  └────────────────┘             ││
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack (Locked Decisions)

| Layer | Technology | Version / Notes |
|---|---|---|
| Mobile framework | React Native (Expo) | Managed dev build, Android-first |
| Mobile language | TypeScript | Strict mode |
| State management | Zustand | Per-module stores, AsyncStorage persistence |
| Offline sync | Central sync queue (`services/syncQueue.ts`) | Retry + exponential backoff, crash-safe |
| Secure storage | `react-native-keychain` | Tokens, sensitive data — NEVER AsyncStorage |
| Charts | react-native-svg custom | Donut, area, progress components |
| Navigation | React Navigation | Stack + Bottom Tabs |
| Backend | Supabase (PostgREST + Edge Functions) | No custom server (ADR-008) |
| DB | PostgreSQL 15 | Hosted on Supabase, migrations in `supabase/migrations/` |
| Auth | Supabase Auth | JWT, shared by mobile + web |
| Push notifications | Expo Push Notifications | Server-triggered via edge functions |
| Local notifications | expo-notifications | Task reminders, bill dues, diet reminders |
| Background scheduler | Expo BackgroundFetch + pg_cron (server-side) | Daily snapshots / reports |
| AI | Groq API — `openai/gpt-oss-120b` (text), `openai/gpt-oss-20b` (fast), `qwen/qwen3.6-27b` (vision) | Edge functions only, free tier |
| Vector store | pgvector (PostgreSQL extension) | Card T&C document embeddings |
| Brokerage | Kite Connect API (Zerodha) | Read-only holdings sync, OAuth callback via edge function |
| Price feeds | Yahoo Finance (equities/ETFs) + AMFI (MF NAVs) | `refresh-portfolio-prices` edge function |
| Web frontend | Vite + React 19 + TypeScript + Tailwind v4 + TanStack Query + Recharts | Netlify free tier |

---

## 3. Database Schema

### 3.1 The Unified Transactions Spine

```sql
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            TEXT NOT NULL CHECK (type IN (
                        'expense', 'credit_card_bill', 'lent', 'borrowed',
                        'fixed_expense', 'fuel_purchase', 'vehicle_service',
                        'portfolio_buy', 'portfolio_sell'
                    )),
    amount          BIGINT NOT NULL,          -- in paise (₹1 = 100 paise)
    currency        TEXT NOT NULL DEFAULT 'INR',
    date            TIMESTAMPTZ NOT NULL,
    category        TEXT,
    linked_account_id   UUID REFERENCES bank_accounts(id),
    linked_card_id      UUID REFERENCES credit_cards(id),
    linked_vehicle_id   UUID REFERENCES vehicles(id),
    linked_holding_id   UUID REFERENCES holdings(id),
    source          TEXT NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual', 'kite_sync')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_linked_account ON transactions(linked_account_id);
CREATE INDEX idx_transactions_linked_card ON transactions(linked_card_id);
```

### 3.2 Finance Module Tables

```sql
-- Credit Cards
CREATE TABLE credit_cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,         -- e.g. "HDFC Regalia"
    bank                TEXT NOT NULL,
    card_limit          BIGINT NOT NULL,       -- in paise
    billing_cycle_date  INT NOT NULL,          -- day of month (1-28)
    due_date_offset     INT NOT NULL DEFAULT 20, -- days after cycle close
    current_outstanding BIGINT NOT NULL DEFAULT 0,
    tnc_document_id     UUID REFERENCES tnc_documents(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank Accounts
CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name       TEXT NOT NULL,
    nickname        TEXT NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN ('savings', 'current', 'fd', 'other')),
    current_balance BIGINT NOT NULL DEFAULT 0,  -- in paise
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lent / Borrowed Records
CREATE TABLE lent_borrowed (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction           TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
    person_name         TEXT NOT NULL,
    amount              BIGINT NOT NULL,
    date                TIMESTAMPTZ NOT NULL,
    expected_settle_date TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'settled', 'partial')),
    amount_settled      BIGINT NOT NULL DEFAULT 0,
    notes               TEXT,
    transaction_id      UUID REFERENCES transactions(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed Expenses (recurring)
CREATE TABLE fixed_expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    amount              BIGINT NOT NULL,
    frequency           TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'weekly')),
    due_day             INT,                    -- day of month
    linked_account_id   UUID REFERENCES bank_accounts(id),
    linked_card_id      UUID REFERENCES credit_cards(id),
    reminder_days_before INT NOT NULL DEFAULT 3,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Card T&C AI Tables

```sql
-- T&C Documents (for RAG)
CREATE TABLE tnc_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    storage_path    TEXT NOT NULL,             -- Supabase Storage path
    processed       BOOLEAN NOT NULL DEFAULT FALSE,
    chunk_count     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- T&C Embeddings (pgvector)
CREATE TABLE tnc_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES tnc_documents(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    chunk_text      TEXT NOT NULL,
    embedding       vector(1536),              -- OpenAI/Claude embedding dim
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tnc_embeddings_doc ON tnc_embeddings(document_id);
CREATE INDEX idx_tnc_embeddings_vector ON tnc_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 3.4 Vehicle Garage Tables

```sql
CREATE TABLE vehicles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('car', 'motorcycle', 'scooter', 'other')),
    registration_number TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fuel_fills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
    odometer_reading    INT NOT NULL,           -- in km
    quantity_liters     NUMERIC(8,2) NOT NULL,
    price_per_liter     BIGINT NOT NULL,        -- in paise
    total_amount        BIGINT NOT NULL,        -- in paise (quantity × price)
    date                TIMESTAMPTZ NOT NULL,
    station_name        TEXT,
    mileage_since_last  NUMERIC(6,2),          -- km/L, computed on insert
    transaction_id      UUID REFERENCES transactions(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_spends (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
    type            TEXT NOT NULL CHECK (type IN ('service', 'repair', 'insurance', 'accessory', 'other')),
    amount          BIGINT NOT NULL,
    date            TIMESTAMPTZ NOT NULL,
    odometer_reading INT,
    description     TEXT,
    transaction_id  UUID REFERENCES transactions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.5 Task Manager Tables

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    due_date        TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
    priority        TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags            TEXT[] DEFAULT '{}',
    project         TEXT,
    recurrence_rule TEXT,                      -- iCal RRULE format
    parent_task_id  UUID REFERENCES tasks(id),
    sort_order      INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_reminders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    remind_at   TIMESTAMPTZ NOT NULL,
    notified    BOOLEAN NOT NULL DEFAULT FALSE
);
```

### 3.6 Equity / MF Tracker Tables

```sql
CREATE TABLE holdings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          TEXT NOT NULL,             -- e.g. "RELIANCE" or "INF200K01RO6"
    fund_name       TEXT,                      -- MF display name
    type            TEXT NOT NULL CHECK (type IN ('equity', 'mf', 'etf', 'other')),
    quantity        NUMERIC(15,4) NOT NULL,
    avg_buy_price   BIGINT NOT NULL,           -- in paise
    current_price   BIGINT,                    -- in paise, updated by sync job
    current_value   BIGINT,                    -- quantity × current_price
    source          TEXT NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual', 'kite_sync')),
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date                DATE NOT NULL UNIQUE,
    total_value         BIGINT NOT NULL,       -- in paise
    day_change          BIGINT,                -- in paise
    day_change_pct      NUMERIC(6,4),
    allocation_json     JSONB,                 -- {symbol: value, ...}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investment_goals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_name           TEXT NOT NULL,
    target_amount       BIGINT NOT NULL,       -- in paise
    target_date         DATE,
    current_progress    BIGINT NOT NULL DEFAULT 0,
    linked_holding_ids  UUID[],
    priority            TEXT DEFAULT 'medium',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.7 Personal Notes & Goals Tables

```sql
CREATE TABLE goals_2026 (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT,
    category    TEXT CHECK (category IN ('health', 'career', 'personal', 'financial', 'other')),
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fulfilled', 'failed')),
    target_date DATE,
    reflection  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    body        TEXT,                          -- rich text (Markdown)
    tags        TEXT[] DEFAULT '{}',
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    ingredients JSONB NOT NULL DEFAULT '[]',   -- [{name, qty, unit}]
    steps       JSONB NOT NULL DEFAULT '[]',   -- [{step_num, instruction}]
    prep_time   INT,                           -- minutes
    tags        TEXT[] DEFAULT '{}',
    source_notes TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE diet_plan_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_date       DATE NOT NULL,
    meal_slot       TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
    recipe_id       UUID REFERENCES recipes(id),
    freeform_meal   TEXT,
    calorie_estimate INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(plan_date, meal_slot)
);
```

---

## 4. Backend Architecture (Supabase BaaS — ADR-008)

### 4.1 Layer Responsibilities

```
Mobile/Web App
    ↓ PostgREST (supabase-js)
Supabase PostgreSQL (RLS-enforced tables)
    ↓ pg_cron → pg_net (scheduled jobs)
Edge Functions (Deno/TS) → Groq API / Kite / Yahoo / AMFI
```

| Layer | Responsibility | Rule |
|---|---|---|
| **Mobile/Web client** | CRUD via supabase-js, optimistic local-first updates | No secrets, no direct external API calls |
| **PostgREST + RLS** | Row-level auth — every table policy-scoped to `auth.uid()` | Every table must have RLS before use |
| **Edge Functions** | AI calls, OAuth callbacks, external API sync, push | Must follow SAFETY.md rules; secrets via `supabase secrets` |
| **pg_cron jobs** | Scheduled tasks (price refresh → portfolio snapshot) | Defined in migrations |

### 4.2 Standard API Pattern

CRUD is direct to PostgREST; Edge Functions are reserved for anything needing secrets or external APIs. Client calls use `supabase.functions.invoke('<fn>', { body })`.

### 4.3 Authentication Flow

```
Mobile/Web App → Supabase Auth (email + password)
              ← JWT access token + refresh token
              → Store securely in Keychain (mobile) — NOT AsyncStorage
              → Every PostgREST call carries the JWT; RLS scopes rows to auth.uid()
              → On sign-in: processSyncQueue() flushes offline-queued data
```

---

## 5. Mobile Architecture (React Native)

### 5.1 Feature Module Structure

```
mobile/src/modules/finance/
├── screens/
│   ├── FinanceDashboardScreen.tsx
│   ├── CreditCardsScreen.tsx
│   └── ...
├── components/
│   ├── TransactionCard.tsx
│   └── ...
├── hooks/
│   ├── useCreditCards.ts       ← TanStack Query hooks
│   └── useTransactions.ts
├── store.ts                    ← Zustand slice
├── api.ts                      ← API calls for this module
└── types.ts                    ← TypeScript types
```

### 5.2 Offline-First Pattern

```
User Action
    ↓
Write to local Zustand store (immediate, optimistic — AsyncStorage persisted)
    ↓
Enqueue sync op in meridian_sync_queue (always, regardless of auth state)
    ↓
processSyncQueue resolves user_id from session at flush time
    (on focus / on sign-in / via BackgroundFetch)
    ↓
Upsert to Supabase (per-entity ON_CONFLICT_TARGET), retry with backoff (max 5)
    ↓
On focus: pull latest from Supabase and merge into local store
```

### 5.3 Notification Architecture

| Notification Type | Mechanism | Trigger |
|---|---|---|
| Task reminder | expo-notifications local | Scheduled at task create/edit |
| Fixed expense / card due | expo-notifications local | N days before due |
| Diet reminder | expo-notifications local | Diet plan schedule |
| Daily portfolio report | Expo push (server) | pg_cron → portfolio-snapshot edge fn, 8:30 PM IST |
| Daily AI report | Expo push (server) | ai-daily-report edge fn, 9:30 PM / 8:30 AM IST |

**Rule**: All notification scheduling must survive app kill. Never use `setTimeout` or `setInterval` for notifications.

---

## 6. AI Integration Architecture

All AI goes through Supabase Edge Functions → Groq API. Shared client: `supabase/functions/_shared/groq.ts` (text: `openai/gpt-oss-120b` / `openai/gpt-oss-20b`; vision: `qwen/qwen3.6-27b`).

### 6.1 Card T&C RAG Pipeline

```
User uploads PDF → Supabase Storage
    ↓
Edge function: extract text, chunk it, store chunks in tnc_embeddings
    ↓
User asks question
    ↓
ai-tnc-query: embed question → cosine similarity search → top-K chunks
    ↓
Build prompt: system + retrieved chunks + user question
    ↓
Groq API call → grounded answer (temperature 0.1)
    ↓
Always append disclaimer to response
```

### 6.2 Portfolio Recommendation Flow

```
User opens AI Recommendations screen
    ↓
ai-portfolio-recommend: fetch holdings + investment_goals (percentages only, no PII)
    ↓
Build structured prompt
    ↓
Groq API call with system prompt defining scope
    ↓
Response: plain-language suggestions
    ↓
Mobile/web: display with "Not financial advice" disclaimer banner
```

### 6.3 Meal AI + Daily Reports

- `ai-meal-log` — vision-model macro analysis of meal photos; `manageMode` returns structured `proposedChanges` (add/delete/modify) applied only after user confirmation
- `ai-meal-suggest` — meal suggestions from the user's recipes/macros
- `ai-daily-report` — aggregated day summary (9:30 PM) + morning plan (8:30 AM), delivered via Expo push

---

## 7. Derived Metrics & Computed Values

| Metric | Formula | Where Computed |
|---|---|---|
| Net worth | `Σ(bank_balances) − Σ(card_outstanding) − Σ(borrowed) + Σ(lent)` | Backend query / client calculation |
| Mileage since last fill | `(current_odometer − previous_odometer) / quantity_liters` | Backend on fuel_fill insert |
| Cost per km | `total_spend_period / total_km_driven_period` | Backend on-demand query |
| Holding P&L | `(current_price − avg_buy_price) × quantity` | Client-side from API data |
| Goal progress | `Σ(current_value of linked_holding_ids)` or manual value | Backend aggregate |

---

## 8. Environment Variables Required

```bash
# Supabase Edge Function secrets (set via `supabase secrets set`)
GROQ_API_KEY=gsk_...
KITE_API_KEY=<key>
KITE_API_SECRET=<secret>
EXPO_PUSH_TOKEN / project refs as needed

# Mobile .env (EXPO_PUBLIC_* — no secrets, public values only)
EXPO_PUBLIC_SUPABASE_URL=https://rkmouoglorsnijmemmcd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
EXPO_PUBLIC_KITE_API_KEY=<kite_api_key>   # OAuth launch only

# Web .env (VITE_*)
VITE_SUPABASE_URL=https://rkmouoglorsnijmemmcd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

> Full template: `.env.example` at repo root. NEVER commit real `.env` files.

---

## 9. Architecture Decision Records (ADR) Index

| ADR | Decision |
|---|---|
| [ADR-001](ADR/ADR-001-tech-stack.md) | React Native over Flutter/Next.js (original stack decision) |
| [ADR-002](ADR/ADR-002-unified-transactions.md) | Single `transactions` table spine over per-module tables |
| [ADR-003](ADR/ADR-003-monetary-integers.md) | Store money as paise integers, never floats |
| [ADR-004](ADR/ADR-004-offline-first.md) | Offline-first CRUD via local store + central sync queue |
| [ADR-005](ADR/ADR-005-notification-workmanager.md) | Native scheduling over JS timers (now expo-notifications local scheduling) |
| [ADR-006](ADR/ADR-006-ai-scoping.md) | AI calls strictly scoped and disclaimed (originally Claude; now Groq, see ADR-008) |
| [ADR-008](ADR/ADR-008-baas-first.md) | **BaaS-first: Supabase replaces FastAPI backend** — current architecture |
