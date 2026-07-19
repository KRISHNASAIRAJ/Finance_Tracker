# ARCHITECTURE.md — System Architecture Document
## Personal Tracker App · Krishna's Tracker · v1.0

> **Audience**: AI agents and developers implementing features.  
> **Source of truth for**: data models, system topology, integration patterns, and key design decisions.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    KRISHNA'S TRACKER                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               React Native App (Android)            │   │
│  │                                                     │   │
│  │   Finance  │  Garage  │  Tasks  │  Equity  │  More  │   │
│  │                                                     │   │
│  │   SQLite local cache (offline reads/writes)         │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │ HTTPS / REST API                    │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │              FastAPI Backend (Python)               │   │
│  │                                                     │   │
│  │  Routers → Services → ORM Models → PostgreSQL       │   │
│  │                                                     │   │
│  │  AI Services       Cron Jobs        FCM Push        │   │
│  │  (Claude API)      (8:30 PM report) (Firebase)      │   │
│  └─────┬───────────────────────────────┬───────────────┘   │
│        │                               │                    │
│  ┌─────▼──────────┐          ┌─────────▼──────────┐        │
│  │   Supabase     │          │   External APIs     │        │
│  │   PostgreSQL   │          │   - Claude API      │        │
│  │   + Auth       │          │   - Kite Connect    │        │
│  │   + Storage    │          │   - FCM             │        │
│  └────────────────┘          └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack (Locked Decisions)

| Layer | Technology | Version / Notes |
|---|---|---|
| Mobile framework | React Native | 0.74+ with New Architecture |
| Mobile language | TypeScript | Strict mode |
| State management | Zustand | Lightweight, per-module slices |
| Server state / caching | TanStack Query (React Query) | Offline persistence via SQLite |
| Local DB | SQLite (via `expo-sqlite` or `op-sqlite`) | Offline-first CRUD queue |
| Secure storage | `react-native-keychain` | Tokens, sensitive data — NEVER AsyncStorage |
| Charts | Victory Native v40+ | Line, donut, bar |
| Navigation | React Navigation v7 | Stack + Tab + Drawer |
| Backend | FastAPI (Python 3.12) | Async routes |
| ORM | SQLAlchemy 2.0 (async) + Alembic | PostgreSQL interactions |
| DB | PostgreSQL 15 | Hosted on Supabase |
| Auth | Supabase Auth | JWT tokens |
| Push notifications | Firebase Cloud Messaging | Server-triggered |
| Local notifications | `@notifee/react-native` | Task reminders, SMS confirms |
| Background scheduler | Android WorkManager (via native module) | 8:30 PM cron on device |
| AI | Anthropic Claude API (claude-3-5-sonnet) | See SAFETY.md for usage rules |
| Vector store | pgvector (PostgreSQL extension) | Card T&C document embeddings |
| Brokerage | Kite Connect API (Zerodha) | Verify pricing before Phase 5 |
| Hosting | Supabase + small VPS or Railway | Backend FastAPI instance |

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
                        CHECK (source IN ('manual', 'sms_auto', 'kite_sync')),
    notes           TEXT,
    raw_sms_text    TEXT,                     -- stored only for sms_auto source
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

## 4. Backend Architecture (FastAPI)

### 4.1 Layer Responsibilities

```
Request → Router → Service → Repository (SQLAlchemy) → PostgreSQL
                ↓
         External Services (Claude API, Kite, FCM)
```

| Layer | Responsibility | Rule |
|---|---|---|
| **Router** | HTTP handling, auth validation, request parsing | No business logic here |
| **Service** | Business logic, orchestration, AI calls | No direct DB queries — use repository |
| **Repository** | SQLAlchemy queries, DB transactions | No business logic |
| **Schema** | Pydantic I/O validation | Input sanitization happens here |
| **AI service** | Claude API calls only | Must follow SAFETY.md rules |
| **Cron jobs** | Scheduled tasks (portfolio report) | In `jobs/` directory |

### 4.2 Standard API Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 42, "page": 1, "per_page": 20 },
  "error": null
}
```

### 4.3 Authentication Flow

```
Mobile App → POST /auth/login (Supabase)
           ← JWT access token + refresh token
           → Store securely in Keychain (NOT AsyncStorage)
           → Include in every API call: Authorization: Bearer <token>
           → Backend validates JWT via Supabase middleware
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
Write to SQLite (immediate, optimistic)
    ↓
Update Zustand store (UI updates instantly)
    ↓
Queue sync job (WorkManager)
    ↓
On connectivity: POST/PATCH to API → update server
    ↓
On conflict: server wins, re-sync SQLite
```

### 5.3 Notification Architecture

| Notification Type | Mechanism | Trigger |
|---|---|---|
| Task reminder | `@notifee` local notification | WorkManager alarm at reminder time |
| SMS expense confirm | `@notifee` local notification | SMS BroadcastReceiver |
| Daily portfolio report | FCM push | Backend cron job at 8:30 PM IST |
| Fixed expense due | `@notifee` local notification | WorkManager, N days before due |
| Credit card due | `@notifee` local notification | WorkManager, N days before due |

**Rule**: All notification scheduling must survive app kill. Never use `setTimeout` or `setInterval` for notifications.

---

## 6. AI Integration Architecture

### 6.1 Card T&C RAG Pipeline

```
User uploads PDF
    ↓
Backend: extract text (PyPDF2 / pdfminer)
    ↓
Chunk text (512 tokens, 50-token overlap)
    ↓
Embed chunks (Claude embeddings or text-embedding-3-small)
    ↓
Store in pgvector (tnc_embeddings table)
    ↓
User asks question
    ↓
Embed question → cosine similarity search → top-K chunks
    ↓
Build prompt: system + retrieved chunks + user question
    ↓
Claude API call → grounded answer
    ↓
Always append disclaimer to response
```

### 6.2 Portfolio Recommendation Flow

```
User opens AI Recommendations screen
    ↓
Backend: fetch holdings + investment_goals
    ↓
Build structured prompt (no raw PII — only aggregated portfolio data)
    ↓
Claude API call with system prompt defining scope
    ↓
Response: plain-language suggestions
    ↓
Mobile: display with "Not financial advice" disclaimer
```

### 6.3 SMS Parsing Flow

```
Incoming SMS
    ↓
BroadcastReceiver → check sender ID against allowlist
    ↓
Regex/rules engine → try to parse amount, merchant, last4
    ↓
If parse fails → Claude API fallback (pass SMS text + parsing schema)
    ↓
Store parsed result in pending_transactions queue
    ↓
Local notification → user confirms or ignores
    ↓
On confirm → write to transactions table (source: sms_auto)
```

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
# Backend .env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/krishnas_tracker
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_ANON_KEY=<anon_key>
ANTHROPIC_API_KEY=sk-ant-...
FIREBASE_SERVICE_ACCOUNT_JSON=<base64 encoded JSON>
KITE_API_KEY=<key>              # Phase 5 only — verify pricing first
KITE_API_SECRET=<secret>        # Phase 5 only
ENCRYPTION_SECRET_KEY=<32-byte hex>

# Mobile .env (via react-native-dotenv or expo constants)
API_BASE_URL=https://<your-backend>.com/api/v1
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon_key>
FIREBASE_APP_ID=<android_app_id>
```

---

## 9. Architecture Decision Records (ADR) Index

| ADR | Decision |
|---|---|
| [ADR-001](ADR/ADR-001-tech-stack.md) | React Native + FastAPI over Flutter or Next.js |
| [ADR-002](ADR/ADR-002-unified-transactions.md) | Single `transactions` table spine over per-module tables |
| [ADR-003](ADR/ADR-003-monetary-integers.md) | Store money as paise integers, never floats |
| [ADR-004](ADR/ADR-004-offline-first.md) | SQLite queue + WorkManager for offline-first CRUD |
| [ADR-005](ADR/ADR-005-notification-workmanager.md) | WorkManager/AlarmManager over JS timers |
| [ADR-006](ADR/ADR-006-ai-scoping.md) | Claude API calls strictly scoped (two use cases only in v1) |
