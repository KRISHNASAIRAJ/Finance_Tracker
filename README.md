# Meridian — Personal Life Tracker

[![CI](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/ci.yml)
[![Deploy](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/deploy.yml)
[![Android Release](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/android-release.yml/badge.svg)](https://github.com/KRISHNASAIRAJ/Finance_Tracker/actions/workflows/android-release.yml)

Meridian is a personal-use mobile app (Android-first) that unifies daily life tracking across seven modules. Built with React Native (Expo) and Supabase, featuring offline-first sync, AI-powered insights, and Android home screen widgets.

## Download APK

Every push to `main` automatically builds a signed release APK and publishes it to [GitHub Releases](https://github.com/KRISHNASAIRAJ/Finance_Tracker/releases).

1. Open the latest release and download `meridian-<tag>.apk`
2. Transfer to your Android device and install (allow "install from unknown sources")

Manual release: `git tag v1.0.1 && git push origin v1.0.1` — or use the **Android Release** workflow button in the Actions tab.

## Modules

| Module | Description |
|---|---|
| **Home (Finance)** | Net-worth hero, monthly spends, bank balances, credit cards, lending/borrowing, PayZapp wallet, expense-distribution donut, recent transactions |
| **Garage** | Fuel fills, mileage tracking, service/maintenance spend, multi-vehicle support |
| **Tasks** | Tasks with subtasks, recurrence, auto-create from recurrence, local notifications |
| **Wealth (Equity/MF)** | Holdings, Kite Connect sync, segmented allocation donut, AI portfolio recommendations, daily 8:30 PM IST portfolio snapshots via pg_cron, live price refresh (Yahoo Finance + AMFI) with today's P&L |
| **Personal** | Goals, notes, recipes, diet plans with onboarding flow, diet notifications |
| **Career** | Career ups & downs with area chart visualization, event timeline |
| **Meals** | Daily meal logging with macro progress bars, Groq AI meal suggestions via chat |

## Cross-Module Integration

- **Fuel → Finance:** Fuel fill expenses flow from Garage into Finance dashboards (donut charts, monthly spends, reports). Editing a fuel entry from any Finance screen opens the Garage EditFuelFill screen.
- **Garage sync:** Fills sync from Supabase on app startup via `GarageSyncInitializer` in RootNavigator.
- **Card bill payment:** Mark credit card bills as paid from the card detail screen; re-sorts cards by due date.
- **Recurrence auto-create:** Checking off a recurring task auto-creates the next occurrence.

## Android Home Screen Widgets

Four 2×2 home screen widgets for one-tap access:

| Widget | Deep Link | Opens |
|---|---|---|
| Add Expense | `meridian://add-expense` | Finance → Add Expense screen |
| Add Fuel | `meridian://add-fuel` | Garage → Add Fuel Fill screen |
| Add Task | `meridian://add-task` | Tasks → Add Task screen |
| Combined Report | `meridian://combined-report` | More → Combined Report screen |

## Tech Stack

- **Mobile:** React Native (Expo) + TypeScript
- **State:** Zustand + AsyncStorage (persistent)
- **Navigation:** React Navigation (Native Stack + Bottom Tabs)
- **Backend:** Supabase (PostgreSQL + Edge Functions in Deno/TypeScript)
- **Auth:** Supabase Auth (JWT)
- **AI:** Groq API (GPT-OSS 120B text + Qwen3.6-27B vision, via edge functions)
- **Notifications:** Expo Push Notifications + local scheduling
- **Design:** Dark mode first — Glass Noir design system (pure-black canvas, white-translucent glass panels, floating glassy tab bar), centered around a monochrome brand mark
- **UX:** Draggable AI assistant FABs with per-screen position persistence; segmented gradient donut charts

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
│   ├── src/
│   │   ├── modules/       ← Feature modules (finance, garage, equity, tasks, personal, career, meals, diary)
│   │   ├── shared/        ← Shared components, theme, utilities
│   │   ├── navigation/    ← Navigator setup
│   │   └── services/      ← API clients, sync queue, notifications, backups
│   └── android/           ← Android native layer (widgets)
└── supabase/
    ├── config.toml         ← Supabase project config
    ├── migrations/        ← SQL migration files (26 migrations)
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

- **App → Cloud:** Every mutation (create/edit/delete) writes to local Zustand store, then enqueues a sync operation. Data is always enqueued regardless of auth state; `processSyncQueue` resolves `user_id` from the current session at flush time.
- **Cloud → App:** On every screen focus, the latest data is pulled from Supabase and merged into the local store.
- **Auto-sync on sign-in:** `AuthProvider` triggers `processSyncQueue` immediately after login, flushing all offline-queued data.
- **Background sync:** Expo BackgroundFetch runs periodically to flush pending offline changes.

All modules share a common sync queue (`meridian_sync_queue` in AsyncStorage) with retry and exponential backoff (max 5 retries).

## Live Portfolio Prices

Wealth holdings get live prices automatically:

- **`refresh-portfolio-prices` edge function** fetches live quotes from Yahoo Finance (equities/ETFs) and AMFI (mutual fund NAVs), updating `current_price` and `prev_close` per holding.
- Called before the daily 8:30 PM snapshot and manually via the refresh button on the portfolio hero card.
- Today's P&L is computed live as `Σ quantity × (current_price − prev_close)`; unchanged snapshot values slide the snapshot date forward instead of duplicating rows.

## Conventions

- **TypeScript only** — no plain JS
- Dates stored as UTC, displayed in IST (Asia/Kolkata)
- Monetary values in paise (integers) — never floats in DB
- DB tables: `snake_case`, migrations: numbered, edge functions: `kebab-case`
- Screens: `PascalCaseScreen`, components: `PascalCase`, stores: `camelCaseStore`
- All financial events route through the unified `transactions` table
- No dummy/seed data in stores — all data is user-generated
- Every source file carries a JSDoc header describing its role

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
| CI/CD pipeline | `docs/ci-cd.md` |

## Roadmap

| Phase | Status |
|---|---|
| Phase 0–9 (mobile: finance, garage, tasks, wealth, AI, personal, polish) | 🟢 100% |
| **Phase 10 — Web App** | 🟡 Planned |

**Phase 10 — Web App (planned):** A full-featured website mirroring the mobile app — same Supabase data, same modules, same functionality. Reuses the existing Supabase backend (tables, RLS, edge functions) with no new backend. Email + password login via Supabase Auth (same accounts as the app). All free resources only (free hosting on Vercel/Netlify/Cloudflare Pages, existing Supabase free tier, existing Groq AI). Candidate stack: React + Vite or Next.js, TypeScript, deployed free. Mobile app keeps working unchanged. Details in `AGENTS.md` § Phase 10.

## License

Private — personal use only.
