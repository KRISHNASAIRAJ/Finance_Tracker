# Meridian — Personal Life Tracker

Meridian is a personal-use mobile app (Android-first) that unifies daily life tracking across five modules, built with React Native (Expo) and Supabase.

## Modules

| Module | Description |
|---|---|
| **Finance Tracker** | Credit cards, bank balances, lending/borrowing, daily expenses, SMS auto-capture, AI T&C assistant |
| **Vehicle Garage** | Fuel fills, mileage tracking, service/maintenance spend |
| **Task Manager** | Notion-style tasks with subtasks, recurrence, and local notifications |
| **Equity/MF Tracker** | Holdings, Kite Connect sync, AI rebalancing, daily 8:30 PM IST portfolio snapshots |
| **Personal** | 2026 goals, notes, recipes, diet plan with onboarding flow |

## Tech Stack

- **Mobile:** React Native (Expo) + TypeScript
- **State:** Zustand + AsyncStorage
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
├── mobile/                ← React Native app (Expo)
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

## Conventions

- **TypeScript only** — no plain JS
- Dates stored as UTC, displayed in IST (Asia/Kolkata)
- Monetary values in paise (integers) — never floats in DB
- DB tables: `snake_case`, migrations: numbered, edge functions: `kebab-case`
- Screens: `PascalCaseScreen`, components: `PascalCase`, stores: `camelCaseStore`
- All financial events route through the unified `transactions` table

## Documentation

| Area | Document |
|---|---|
| Full product spec | `PRD.md` |
| System design | `ARCHITECTURE.md` |
| DB schema | `docs/db-schema.md` |
| UI design system | `DESIGN.md` |
| API contracts | `docs/api-contracts.md` |
| SMS parser spec | `docs/sms-parser-spec.md` |
| Notification flows | `docs/notification-flows.md` |
| AI safety rules | `SAFETY.md` |

## License

Private — personal use only.
