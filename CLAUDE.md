# CLAUDE.md — Claude Code Session Instructions
## Meridian — Personal Life Tracker

> This file is read by Claude Code at the start of every session.
> For full project context, read `AGENTS.md` first.

---

## Quick Start Checklist for Every Session

1. **Read `AGENTS.md`** — understand current phase and repo structure
2. **Read `BOUNDARIES.md`** — know what you must NOT do before writing code
3. **Read `DESIGN.md`** — before implementing ANY screen or UI component
4. **Check the current phase** in `AGENTS.md` Section 3 — only work within the active phase
5. **Read `SAFETY.md`** before touching anything in `supabase/functions/`
6. **Read `ARCHITECTURE.md`** for data models — source of truth for all table schemas

---

## Phase Progress (Last assessed: 2026-09-13)

| Phase | % | Status | What's Done | What's Left |
|-------|---|--------|-------------|-------------|
| **0 — Foundation** | 100% | 🟢 | 36 migrations (24+ tables), RLS on all tables, config.toml, supabase client, syncQueue, AuthProvider, keychain | Nothing |
| **1 — Finance** | 100% | 🟢 | 15+ screens, add-card/delete-card, bank/cardLimit fields, typed store, dynamic donut ring, bidirectional sync, budgets, expected income, PayZapp loads | Nothing |
| **2 — Garage** | 100% | 🟢 | Multi-vehicle UI, FAB menu, maintenance screen, fuel fill/service logs, mileage calc, 8 service types, service reminders, sync on all CRUD | Nothing |
| **3 — Tasks** | 100% | 🟢 | Screens, sync hook, edit mode, recurrence auto-create, notification scheduling on all CRUD, buy/grocery lists with date reminders | Nothing |
| **4 — Equity** | 100% | 🟢 | Kite OAuth + equity+MF sync, allocation donut, pg_cron 8:30 PM IST snapshots, Expo push, goal auto-progress, live prices (Yahoo + AMFI), net worth + loans + FDs | Nothing |
| **5 — SMS** | — | 🔴 | Removed from project | — |
| **6 — AI Assistants** | 100% | 🟢 | Card T&C chat (RAG), portfolio recs (goal-aware), meal AI (photo analyze + chat manage + suggest), daily Groq reports | Nothing |
| **7 — Personal** | 100% | 🟢 | Goals, notes, recipes, diet plans with onboarding flow, diet notifications, Supabase sync on all modules | Nothing |
| **9 — Polish** | 100% | 🟢 | CombinedReport, lint/typecheck/jest configs, battery optimization prompt, 4 notification channels, sync queue retry+backoff+crash-safety, Android 13 POST_NOTIFICATIONS | Nothing |
| **10 — Web App** | 100% | 🟢 | `web/` mirrors mobile (all modules + AI), Supabase Realtime, Netlify deploy | Nothing |

All phases complete. Work is now maintenance / feature increments on `v4` branch.

---

## Architecture (ADR-008 — BaaS-first)

```
Mobile (RN) ─── direct ──► Supabase (Postgres + Auth + Storage + Realtime + pg_cron)
Web (Vite)   ─── direct ──►   │
                              └── Edge Functions (Deno/TS) ──► Groq API / Kite / Yahoo / AMFI
```

**No FastAPI (archived — see ADR-008).** CRUD goes to Supabase PostgREST. AI calls go through Edge Functions. All secrets live in Supabase, never in the app.

Cron: pg_cron at 15:00 UTC (8:30 PM IST) refreshes prices → portfolio-snapshot via pg_net.

**Deployed edge functions (all production):** `ai-daily-report`, `ai-meal-log`, `ai-meal-suggest`, `ai-portfolio-recommend`, `ai-tnc-query`, `kite-callback`, `kite-holdings-sync`, `portfolio-snapshot`, `refresh-portfolio-prices`.

---

## Critical Rules (Summary — Full List in BOUNDARIES.md)

- **App name is Meridian** — use this name in all screen titles, app bar headers, and metadata
- **Dark mode first** — implement ALL screens using dark tokens from `DESIGN.md`
- **Money = paise integers always** (₹1 = 100 paise). Never floats.
- **Never AsyncStorage for tokens** — use `react-native-keychain`
- **Never touch `transactions` table structure** without a migration + updating `ARCHITECTURE.md`
- **Groq API only from Edge Functions** — never from mobile/web app directly
- **Every AI response must include disclaimer** — see `SAFETY.md` Section 4
- **Canonical screens = Meridian: prefixed in Stitch** — for screens without that prefix, use layout only and apply dark tokens

---

## Key Commands

```bash
# Mobile Android dev build
cd mobile && npm run android

# Web dev
cd web && npm run dev

# Create new Supabase migration
supabase migration new <description>

# Push migrations + deploy config changes
supabase db push

# Deploy Edge Functions
supabase functions deploy <fn-name>

# Run mobile linting + typecheck + tests
cd mobile && npm run lint && npm run typecheck && npm test

# Set Edge Function secrets
supabase secrets set GROQ_API_KEY=gsk_...

# Link project
supabase link --project-ref rkmouoglorsnijmemmcd
```

---

## If You're Unsure

1. Check `PRD.md` for product intent
2. Check `ARCHITECTURE.md` for technical decisions
3. Check `BOUNDARIES.md` for what's off-limits
4. Check `ADR/ADR-008-baas-first.md` for the architecture decision
5. If a BOUNDARY needs to change, **stop and ask** — don't work around it
