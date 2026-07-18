# AGENTS.md — AI Agent Governance File
## Meridian — Personal Life Tracker

> **This file is the authoritative operating manual for any AI coding agent (Claude Code, Cursor, Copilot, etc.) working on this repository.**  
> Read this file IN FULL at the start of every session before writing a single line of code.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **App Name** | Meridian |
| **Type** | Personal-use mobile app (Android-first) |
| **Platform** | React Native (Android → iOS later) |
| **Backend** | FastAPI (Python) |
| **Database** | PostgreSQL (Supabase-hosted) + SQLite local cache |
| **Auth** | Supabase Auth / JWT |
| **AI Layer** | Claude API (Anthropic) — scoped assistants only |
| **Notifications** | Firebase Cloud Messaging (FCM) + local AlarmManager/WorkManager |
| **Design** | Dark mode first — all screens implemented in dark. See `DESIGN.md` |
| **Stitch Project** | https://stitch.withgoogle.com/projects/4997376971246377666 |
| **PRD Reference** | `PRD.md` — read it before implementing any feature |

---

## 2. Repository Structure (Canonical)

```
krishnas-tracker/
├── AGENTS.md                  ← This file (read first)
├── PRD.md                     ← Product Requirements Document
├── ARCHITECTURE.md            ← System design & data models
├── BOUNDARIES.md              ← Hard constraints & off-limits rules
├── SAFETY.md                  ← AI safety & data privacy guardrails
├── DESIGN.md                  ← UI design system, component specs, screen breakdown (Stitch-sourced)
├── ADR/                       ← Architecture Decision Records
│   ├── ADR-001-tech-stack.md
│   ├── ADR-002-unified-transactions.md
│   └── ...
├── docs/
│   ├── api-contracts.md       ← API endpoint specs
│   ├── db-schema.md           ← Full DB schema reference
│   ├── notification-flows.md  ← Notification trigger maps
│   └── sms-parser-spec.md     ← SMS parsing rules
├── mobile/                    ← React Native app
│   ├── src/
│   │   ├── modules/           ← Feature modules (finance, garage, tasks, equity, personal, fitness)
│   │   ├── shared/            ← Shared components, hooks, utils
│   │   ├── navigation/        ← React Navigation setup
│   │   ├── store/             ← Zustand global state
│   │   └── services/          ← API clients, local DB, notifications
│   └── android/               ← Android native layer
├── backend/                   ← FastAPI backend
│   ├── app/
│   │   ├── main.py            ← FastAPI app entry point
│   │   ├── config.py          ← Settings / env vars
│   │   ├── database.py        ← SQLAlchemy engine & session
│   │   ├── routers/           ← API route handlers (7 routers)
│   │   ├── services/          ← Business logic layer
│   │   ├── models/            ← SQLAlchemy ORM models (15 models)
│   │   ├── schemas/           ← Pydantic request/response schemas (15 schemas)
│   │   ├── ai/                ← AI service wrappers (Claude API) [future]
│   │   └── jobs/              ← Cron jobs (portfolio report) [future]
│   ├── migrations/            ← Alembic migration files (wired up)
│   ├── Procfile               ← Render deployment
│   ├── render.yaml            ← Render blueprint (web + postgres)
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── alembic.ini
│   └── tests/                 ← Pytest test suite
└── .env.example               ← Required environment variables
```

---

## 3. Phased Build Roadmap

Always work within the current phase. Do NOT skip ahead.

| Phase | Scope | Status |
|---|---|---|
| **Phase 0** | Foundation: scaffold, auth, DB schema, shared transactions table | ✅ DONE |
| **Phase 1** | Finance Tracker: CRUD + dashboard + basic charts | ⬜ TODO |
| **Phase 2** | Vehicle Garage: fuel fills, service logs, mileage calc | ⬜ TODO |
| **Phase 3** | Task Manager: CRUD, subtasks, recurrence, local notifications | ⬜ TODO |
| **Phase 4** | SMS Auto-capture: listener, parser (rules + Claude fallback), confirm flow | ⬜ TODO |
| **Phase 5** | Equity/MF Tracker: holdings, Kite integration, goals, 8:30 PM cron | ⬜ TODO |
| **Phase 6** | AI Assistants: Card T&C RAG chat, portfolio recommendation (goal-aware) | ⬜ TODO |
| **Phase 7** | Personal Notes & Goals: 2026 goals, notes, recipes, diet plan | ⬜ TODO |
| **Phase 8** | Fitness Widget: Health Connect integration, steps widget | ⬜ TODO |
| **Phase 9** | Polish: cross-module reports, offline hardening, notification reliability | ⬜ TODO |

---

## 4. Mandatory Conventions

### 4.1 General Rules
- **TypeScript only** in the mobile layer — no plain JS files
- **Pydantic v2** for all FastAPI request/response schemas
- **Zod** for client-side schema validation on the mobile side
- All dates stored as **UTC ISO-8601** strings in DB; display in IST (Asia/Kolkata)
- All monetary amounts stored as **integers (paise/cents)** — never floats. Display layer handles formatting
- **Never** commit `.env` files. Use `.env.example` with placeholder values

### 4.2 Naming Conventions
| Layer | Convention | Example |
|---|---|---|
| DB tables | snake_case, plural | `transactions`, `credit_cards` |
| SQLAlchemy models | PascalCase | `CreditCard`, `FuelFill` |
| Pydantic schemas | PascalCase + suffix | `CreditCardCreate`, `CreditCardResponse` |
| FastAPI routers | snake_case files | `routers/credit_cards.py` |
| React Native screens | PascalCase + `Screen` | `FinanceDashboardScreen` |
| React Native components | PascalCase | `TransactionCard`, `DonutChart` |
| Zustand stores | camelCase + `Store` | `financeStore`, `portfolioStore` |
| API endpoints | REST, kebab-case | `/api/v1/credit-cards/{id}` |

### 4.3 Module Boundaries
Each module owns its own:
- Router file (`backend/app/routers/<module>.py`)
- Service file (`backend/app/services/<module>_service.py`)
- ORM models (in `backend/app/models/`)
- Screen files (`mobile/src/modules/<module>/screens/`)
- Zustand slice or store (`mobile/src/modules/<module>/store.ts`)

Modules **share** only:
- `transactions` table (via `linked_*_id` foreign keys)
- `shared/` UI components
- `services/api.ts` (base API client)
- Auth context
- Notification service

### 4.4 The Unified Transactions Spine
**CRITICAL**: Every financial event (expense, fuel fill, vehicle service, portfolio buy/sell, lending) MUST write to the `transactions` table. Do not create isolated spend tables that bypass this spine. See `ARCHITECTURE.md` for the full schema.

### 4.5 Offline-First Rule
Manual data entry (expenses, fuel fills, tasks) must work with no internet. Use SQLite + queue pattern; sync when connectivity returns. Do not block the UI on network calls for CRUD operations.

---

## 5. Available Commands

```bash
# --- MOBILE ---
cd mobile
npm install            # Install dependencies
npm run android        # Run on Android device/emulator
npm run test           # Run Jest tests
npm run lint           # ESLint check
npm run typecheck      # TypeScript check

# --- BACKEND ---
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # Dev server (port 8000)
alembic upgrade head              # Run DB migrations
alembic revision --autogenerate -m "description"  # Create migration
pytest                            # Run all tests
pytest tests/<module>/            # Run module-specific tests

# --- DATABASE ---
# Supabase CLI (local dev)
supabase start        # Start local Supabase stack
supabase db reset     # Reset + re-seed local DB
```

---

## 6. Workflow Rules for Each Session

1. **Read phase first**: Check which phase is active in this file before writing code
2. **Schema before screens**: Always define/migrate DB schema before building UI
3. **API contract before implementation**: Write Pydantic schemas before writing business logic
4. **Test the happy path**: Write at minimum one integration test per new endpoint
5. **Do not modify `transactions` table structure** without updating `ARCHITECTURE.md` and creating an Alembic migration
6. **All AI calls** must follow the rules in `SAFETY.md` — read it before touching `backend/app/ai/`
7. **Notification scheduling** must use `WorkManager`/`AlarmManager` (not JS timers) — see `docs/notification-flows.md`

---

## 7. Key Risks to Keep in Mind

| Risk | Mitigation |
|---|---|
| Kite Connect API pricing | Confirm free-tier access before Phase 5. Implement manual entry as full fallback |
| SMS parsing coverage | Budget for edge cases across HDFC, ICICI, SBI, Axis, Kotak SMS formats |
| Android OEM battery optimization | Prompt user to whitelist app; use `WorkManager` with `KEEP` policy |
| Claude API costs | Gate AI calls behind usage caps; cache responses where appropriate |
| Google Fit API deprecation | Use **Health Connect ONLY** — do not import or reference Google Fit APIs |

---

## 8. References (Read Before Working on Each Area)

| Area | File |
|---|---|
| Full product spec | `PRD.md` |
| System design | `ARCHITECTURE.md` |
| Hard constraints | `BOUNDARIES.md` |
| AI safety rules | `SAFETY.md` |
| UI design system + screens | `DESIGN.md` ← **dark mode first; 16 canonical dark screens + 30 light legacy** |
| API contracts | `docs/api-contracts.md` |
| DB schema | `docs/db-schema.md` |
| SMS parser spec | `docs/sms-parser-spec.md` |
| Notification flows | `docs/notification-flows.md` |
| Screen screenshots index | `docs/screens.md` |
