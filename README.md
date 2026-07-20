# Meridian — Personal Life Tracker

Meridian is a personal-use mobile app (Android-first) that unifies daily life tracking across five modules. Built with React Native (Expo) and Supabase, featuring offline-first sync and AI-powered insights.

## Modules

| Module | Description |
|---|---|
| **Finance Tracker** | Credit cards, bank balances, lending/borrowing, daily expenses, AI T&C assistant, Payzapp wallet |
| **Vehicle Garage** | Fuel fills, mileage tracking, service/maintenance spend |
| **Task Manager** | Notion-style tasks with subtasks, recurrence, and local notifications |
| **Equity/MF Tracker** | Holdings, Kite Connect sync, AI rebalancing, daily 8:30 PM IST portfolio snapshots |
| **Personal** | Goals, notes, recipes, diet plans with onboarding flow |

## Cross-Module Integration

- **Fuel → Finance:** Fuel fill expenses flow from Garage into Finance dashboards (donut charts, monthly spends, reports). Expense totals in Finance are sourced directly from Garage fill data, keeping a single source of truth. Editing a fuel entry from any Finance screen opens the Garage EditFuelFill screen.
- **Garage sync:** Fills sync from Supabase on app startup via `GarageSyncInitializer` in RootNavigator, ensuring correct data before any screen renders. Deletions sync to Supabase immediately to prevent stale re-fetches.

## Tech Stack

- **Mobile:** React Native (Expo) + TypeScript
- **State:** Zustand + AsyncStorage (persistent)
- **Navigation:** React Navigation (Native Stack + Bottom Tabs)
- **Backend:** Supabase (PostgreSQL + Edge Functions in Deno/TypeScript)
- **Auth:** Supabase Auth (JWT)
- **AI:** Groq API (Llama 3.3 70B + Llama 3.1 8B)
- **Notifications:** Expo Push Notifications + local scheduling
- **Design:** Dark mode first, Glassmorphism UI

## Project Structure

```
meridian/
├── AGENTS.md              ← AI agent governance (read first)
├── PRD.md                 ← Product requirements
├── ARCHITECTURE.md        ← System design & data models
├── DESIGN.md              ← UI design system & screen specs
├── SAFETY.md              ← AI safety & data privacy
├── BOUNDARIES.md          ← Hard constraints
├── ADR/                   ← Architecture Decision Records
├── docs/                  ← API contracts, DB schema, notification flows
├── mobile/                ← React Native app
│   └── src/
│       ├── modules/       ← Feature modules (finance, garage, equity, tasks, personal)
│       ├── shared/        ← Shared components, hooks, utilities
│       ├── navigation/    ← Navigator setup
│       ├── store/         ← Zustand global state
│       └── services/      ← API clients, local DB, sync queue, notifications
└── supabase/
    ├── config.toml         ← Supabase project config
    ├── migrations/        ← SQL migration files
    └── functions/         ← Deno Edge Functions
```

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (optional, for edge function development)

### Install & Run

```bash
# Clone and install
cd mobile
npm install

# Copy environment template (fill in your Supabase URL + anon key)
cp ../.env.example .env

# Start Expo dev server
npx expo start

# Run on Android
npx expo run:android
```

Alternatively, use the install script:

```powershell
.\scripts\install-dev.ps1
```

## Available Commands

```bash
cd mobile
npm run android        # Run on connected device/emulator
npm run ios            # Run on iOS simulator
npm test               # Jest test suite
npm run lint           # ESLint check
npm run typecheck      # TypeScript type check

# Supabase
supabase link --project-ref rkmouoglorsnijmemmcd
supabase db push       # Push migrations
supabase functions deploy <fn>  # Deploy edge function
```

## Environment Variables

Copy `.env.example` to `mobile/.env` and configure:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (publishable) key |
| `EXPO_PUBLIC_KITE_API_KEY` | Kite Connect API key (for equity sync) |

## Data Sync Architecture

Meridian uses an offline-first bidirectional sync pattern:

- **App → Cloud:** Every mutation (create/edit/delete) writes to local Zustand store, then enqueues a sync operation. The queue is flushed immediately after each task change and on app foreground/background transitions.
- **Cloud → App:** On every screen focus, the latest data is pulled from Supabase and merged into the local store. New items from cloud are added; existing items are updated with cloud state.
- **Initial sync:** On first launch, if cloud is empty, local data is seeded to Supabase. If cloud has data, it's pulled and merged locally.
- **Background sync:** Expo BackgroundFetch runs periodically to flush any pending offline changes.

All modules share a common sync queue (`meridian_sync_queue` in AsyncStorage) with retry and exponential backoff (max 5 retries).

## Conventions

- **TypeScript only** — no plain JS
- Dates stored as UTC, displayed in IST (Asia/Kolkata)
- Monetary values in paise (integers) — never floats in DB
- DB tables: `snake_case`, migrations: numbered, edge functions: `kebab-case`
- Screens: `PascalCaseScreen`, components: `PascalCase`, stores: `camelCaseStore`
- All financial events route through the unified `transactions` table
- No dummy/seed data in stores — all data is user-generated

## Documentation

| Area | Document |
|---|---|
| Full product spec | `PRD.md` |
| System design | `ARCHITECTURE.md` |
| DB schema | `docs/db-schema.md` |
| UI design system | `DESIGN.md` |
| API contracts | `docs/api-contracts.md` |
| Notification flows | `docs/notification-flows.md` |
| AI safety rules | `SAFETY.md` |

## License

Private — personal use only.
