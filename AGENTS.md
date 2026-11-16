# AGENTS.md — AI Agent Governance File
## Meridian — Personal Life Tracker

> **This file is the authoritative operating manual for any AI coding agent (Claude Code, Cursor, Copilot, etc.) working on this repository.**  
> Read this file IN FULL at the start of every session before writing a single line of code.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **App Name** | Meridian |
| **Type** | Personal-use app (Android-first mobile + web mirror) |
| **Platform** | React Native (Android → iOS later) + Vite/React web |
| **Backend** | Supabase Edge Functions (Deno/TypeScript) — no FastAPI (see ADR-008) |
| **Database** | PostgreSQL (Supabase-hosted), RLS on all tables |
| **Auth** | Supabase Auth / JWT (shared mobile + web) |
| **AI Layer** | Groq API — `openai/gpt-oss-120b` + `openai/gpt-oss-20b` (text), `qwen/qwen3.6-27b` (vision) — free-tier friendly |
| **Notifications** | Expo Push Notifications + expo-notifications local scheduling |
| **Design** | Dark mode first — all screens implemented in dark. See `DESIGN.md` |
| **Stitch Project** | https://stitch.withgoogle.com/projects/4997376971246377666 |
| **PRD Reference** | `PRD.md` — read it before implementing any feature |

---

## 2. Repository Structure (Canonical)

```
krishnas-tracker/
├── AGENTS.md                  ← This file (read first)
├── CLAUDE.md                  ← Claude Code session instructions
├── COMMIT_RULES.md            ← Commit/branch conventions (incl. [AI] prefix rule)
├── PLAN.md                    ← Feature implementation plan (v4 feature log)
├── PRD.md                     ← Product Requirements Document
├── ARCHITECTURE.md            ← System design & data models
├── BOUNDARIES.md              ← Hard constraints & off-limits rules
├── SAFETY.md                  ← AI safety & data privacy guardrails
├── DESIGN.md                  ← UI design system, component specs, screen breakdown (Stitch-sourced)
├── ADR/                       ← Architecture Decision Records
│   ├── ADR-001-tech-stack.md
│   ├── ADR-002-unified-transactions.md
│   └── ... (ADR-008 = current BaaS-first architecture)
├── docs/
│   ├── api-contracts.md       ← Edge function contracts
│   ├── db-schema.md           ← Full DB schema reference
│   ├── notification-flows.md  ← Notification trigger maps
│   ├── screens.md             ← Stitch screen index
│   └── Fundamental_Analysis.md
├── mobile/                    ← React Native app
│   ├── assets/                ← App icons, splash (canonical copies — no dupes at repo root)
│   ├── src/
│   │   ├── modules/           ← Feature modules (finance, garage, tasks, equity, meals, personal, career, diary)
│   │   ├── shared/            ← Shared components, hooks, utils
│   │   ├── navigation/        ← React Navigation setup
│   │   ├── store/             ← Zustand global state
│   │   └── services/          ← API clients, sync queue, notifications, backups
│   └── android/               ← Android native layer (widgets)
├── web/                        ← Web app (Vite + React + TS + Tailwind + TanStack Query + Recharts)
├── supabase/                  ← Supabase project
│   ├── config.toml             ← Supabase project config
│   ├── migrations/            ← SQL migration files (36 as of 2026-09)
│   │   ├── 0001_init.sql      ← Initial tables
│   │   ├── 0002_rls.sql       ← Row-Level Security policies
│   │   └── ...                ← Per-feature add/drop migrations (up to 0036_fixed_deposits.sql)
│   └── functions/             ← Deno Edge Functions (hold secrets)
│       ├── _shared/groq.ts     ← Shared Groq API client
│       ├── ai-tnc-query/       ← Card T&C chat (RAG)
│       ├── ai-portfolio-recommend/  ← Portfolio recs (goal-aware)
│       ├── ai-meal-log/       ← Meal photo analysis + chat manage mode
│       ├── ai-meal-suggest/   ← Meal suggestions
│       ├── ai-daily-report/   ← Evening/morning Groq reports + push
│       ├── kite-holdings-sync/ ← Kite Connect sync
│       ├── kite-callback/      ← Kite OAuth callback
│       ├── portfolio-snapshot/ ← 8:30 PM IST cron
│       └── refresh-portfolio-prices/ ← Yahoo/AMFI live quotes
├── scripts/
│   └── install-dev.ps1        ← Windows dev install script
└── .env.example               ← Required environment variables
```

---

## 3. Phased Build Roadmap

All planned phases are complete. Work is now maintenance / incremental features on the `v4` branch.

| Phase | Scope | Status |
|---|---|---|
| **Phase 0** | Foundation — BaaS-first: Supabase schema + RLS + sync queue + edge function scaffolds | 🟢 100% |
| **Phase 1** | Finance Tracker: CRUD + dashboard + basic charts | 🟢 100% — 15+ screens, budgets, expected income, PayZapp |
| **Phase 2** | Vehicle Garage: fuel fills, service logs, mileage calc | 🟢 100% — multi-vehicle, 8 service types, service reminders |
| **Phase 3** | Task Manager: CRUD, subtasks, recurrence, local notifications | 🟢 100% — incl. buy/grocery lists with date reminders |
| **Phase 4** | Equity/MF Tracker: holdings, Kite integration, goals, 8:30 PM pg_cron | 🟢 100% — live prices (Yahoo+AMFI), net worth + loans + FDs |
| **Phase 5** | SMS Auto-capture — REMOVED from project | 🔴 Removed |
| **Phase 6** | AI Assistants: Card T&C chat, portfolio recommendation, meal AI, daily reports (all Groq via edge functions) | 🟢 100% |
| **Phase 7** | Personal Notes & Goals: 2026 goals, notes, recipes, diet plan | 🟢 100% |
| **Phase 8** | Meals / Career / Diary modules | 🟢 100% — meal logger + nutrition trends, quick meals, meal chat, career events, weekly diary |
| **Phase 9** | Polish: cross-module reports, offline hardening, notification reliability | 🟢 100% — CombinedReport, CI (build-apk.yml), sync queue retry+backoff+crash-safety, 4 notification channels, Android 13 POST_NOTIFICATIONS |
| **Phase 10** | Web App: full-featured website mirroring the mobile app | 🟢 100% |

---

### Phase 10 — Web App (Built)

> **Status:** 🟢 Built on the `v3` branch — `web/` directory, deployed on Netlify free tier.

A website that mirrors the mobile app: same Supabase data, same modules (Finance, Garage, Tasks, Wealth, Personal, Career, Meals, Diary), same functionality. All free resources only.

**Implementation (locked in):**
- **Stack:** Vite + React 19 + TypeScript SPA, React Router v7, TanStack Query v5, Zustand (UI-only), Tailwind CSS v4 (Tracend tokens ported to CSS variables), Recharts.
- **Reuse the existing Supabase backend as-is** — same tables, RLS policies, and edge functions (all AI calls go through `supabase.functions.invoke`). No new backend.
- **Login:** email + password via Supabase Auth (same accounts as the app — no separate user system).
- **Realtime sync:** `web/src/hooks/useRealtimeSync.ts` subscribes to Postgres changes on all 24 user tables and invalidates TanStack Query caches — mobile edits appear on web instantly and vice-versa. Requires migration `0028_realtime_publication.sql` to be pushed (`supabase db push`).
- **Free tier only:** Netlify free hosting, existing Supabase free tier, existing Groq AI.
- Mobile keeps working unchanged; web is additive.
- **Commands:** `cd web && npm run dev` (local), `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## 4. Mandatory Conventions

### 4.1 General Rules
- **TypeScript only** — no plain JS files in mobile; all Edge Functions in Deno/TS
- All dates stored as **UTC timestamps** in DB; display in IST (Asia/Kolkata)
- All monetary amounts stored as **integers (paise/cents)** — never floats
- **Never** commit `.env` files. Use `.env.example` with placeholder values

### 4.2 Naming Conventions
| Layer | Convention | Example |
|---|---|---|
| DB tables | snake_case, plural | `transactions`, `credit_cards` |
| Supabase migrations | numbered, descriptive | `0001_init.sql`, `0004_add_vehicles.sql` |
| Edge Functions | kebab-case directory | `ai-tnc-query/`, `kite-holdings-sync/` |
| React Native screens | PascalCase + `Screen` | `FinanceDashboardScreen` |
| React Native components | PascalCase | `TransactionCard`, `DonutChart` |
| Zustand stores | camelCase + `Store` | `financeStore`, `portfolioStore` |

### 4.3 Module Boundaries
Each module owns its own:
- Screen files (`mobile/src/modules/<module>/screens/`)
- Zustand store slice (`mobile/src/modules/<module>/store.ts`)
- Supabase table(s) + RLS policies (in `supabase/migrations/`)

Modules **share** only:
- `transactions` table (via `linked_*_id` columns)
- `shared/` UI components
- `services/supabaseClient.ts` (central Supabase client)
- `services/syncQueue.ts` (central sync queue)
- Notification service

### 4.4 The Unified Transactions Spine
**CRITICAL**: Every financial event (expense, fuel fill, vehicle service, portfolio buy/sell, lending) MUST write to the `transactions` table. Do not create isolated spend tables that bypass this spine. See `ARCHITECTURE.md` for the full schema.

### 4.5 Offline-First Rule
Manual data entry (expenses, fuel fills, tasks) must work with no internet. Use the local Zustand store (AsyncStorage-persisted) + central sync queue pattern; sync when connectivity returns. Do not block the UI on network calls for CRUD operations.

---

## 5. Available Commands

```bash
# --- MOBILE ---
cd mobile
npm install            # Install dependencies
npm run android        # Run on Android device/emulator
npm test               # Run Jest tests
npm run lint           # ESLint check
npm run typecheck      # TypeScript check

# --- WEB ---
cd web
npm install
npm run dev            # Local dev server
npm run typecheck && npm run lint && npm run build   # Verify

# --- SUPABASE ---
supabase login         # Authenticate CLI (once)
supabase link --project-ref rkmouoglorsnijmemmcd   # Link to project
supabase db push       # Push migrations to Supabase Postgres
supabase functions deploy <fn>    # Deploy an Edge Function
supabase secrets set KEY=VALUE    # Set Edge Function secrets
```

---

## 6. Workflow Rules for Each Session

1. **Read phase first**: Check which phase is active in this file before writing code
2. **Schema before screens**: Always define/migrate DB schema before building UI
3. **Write RLS policy before using table**: Every table read/written from mobile must have a RLS policy
4. **Test the happy path**: Write at minimum one integration test per new feature
5. **Do not modify `transactions` table structure** without updating `ARCHITECTURE.md` and creating a Supabase migration
6. **All AI calls** must follow the rules in `SAFETY.md` — read it before touching `supabase/functions/`
7. **Notification scheduling** must survive app kill (expo-notifications local scheduling — never JS timers) — see `docs/notification-flows.md`

---

## 7. Key Risks to Keep in Mind

| Risk | Mitigation |
|---|---|
| Kite Connect API pricing | Manual holdings entry is the full fallback — already implemented |
| Android OEM battery optimization | Prompt user to whitelist app; background sync via Expo BackgroundFetch |
| Groq API costs | Gate AI calls behind usage caps; cache responses where appropriate (free tier currently covers all use cases) |

---

## 8. References (Read Before Working on Each Area)

| Area | File |
|---|---|
| Full product spec | `PRD.md` |
| System design | `ARCHITECTURE.md` |
| Hard constraints | `BOUNDARIES.md` |
| AI safety rules | `SAFETY.md` |
| UI design system + screens | `DESIGN.md` ← **dark mode first; 16 canonical dark screens + 30 light legacy** |
| DB schema | `docs/db-schema.md` |
| Notification flows | `docs/notification-flows.md` |
| Screen screenshots index | `docs/screens.md` |
| Architecture decision (BaaS-first) | `ADR/ADR-008-baas-first.md` |
