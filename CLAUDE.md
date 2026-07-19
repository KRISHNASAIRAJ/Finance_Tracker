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

## Phase Progress (Last assessed: 2026-07-19)

| Phase | % | Status | What's Done | What's Left |
|-------|---|--------|-------------|-------------|
| **0 — Foundation** | 100% | 🟢 | 11 migrations (16+ tables), RLS fixed, config.toml, supabase client, syncQueue, AuthProvider, keychain, edge function scaffolds | Nothing |
| **1 — Finance** | 100% | 🟢 | 15 screens, add-card/delete-card, bank/cardLimit fields, typed store, dynamic donut ring, bidirectional sync | Nothing |
| **2 — Garage** | 100% | 🟢 | 7 screens, vehicles table + sync, multi-vehicle UI, FAB menu, maintenance screen, sync queue on all CRUD, fuel fill delete, text overflow fixes | Nothing |
| **3 — Tasks** | 100% | 🟢 | 3 screens, sync hook, edit mode, recurrence auto-create, notification scheduling on create/edit/delete/toggle | Nothing |
| **4 — Equity** | 100% | 🟢 | DB tables, Kite OAuth + equity+MF sync, 6 screens (dashboard + add/edit + history + AI recs + goals + holdings list), pg_cron 8:30 PM IST snapshots, portfolio-snapshot edge fn (multi-user + Expo push), goal progress auto-update, allocation donut (Gold/Realty/Equity/MF/ETF), fund name cleaner, MF display fix | Nothing |
| **5 — SMS** | 70% | 🟡 | 4 services (parser/reader/handler/notification), SmsConfirmationScreen, regex rules engine | AI fallback edge function is scaffold |
| **6 — AI Assistants** | 20% | 🔴 | Shared Claude client (production quality), storage bucket | Both edge functions scaffolds, no RAG pipeline, no T&C upload/chat UI |
| **7 — Personal** | 100% | 🟢 | 10 screens (onboarding + menu + notes/goals/recipes/diet), store, Supabase sync (all 4 modules wired: goals, notes, recipes, diet plans), offline queue, diet notifications | Nothing |
| **9 — Polish** | 15% | 🔴 | backupService, backupScheduler, dietNotifications, notificationService | No tests, no cross-module reports, no WorkManager integration |

### Cross-cutting gaps
- **No Jest tests anywhere** — zero `__tests__` directories
- **3/6 edge functions are scaffolds** — portfolio-snapshot, kite-holdings-sync, kite-callback done; ai-sms-parse, ai-tnc-query, ai-portfolio-recommend are scaffolds
- **Equity + Finance + Garage + Personal have Supabase sync** — all modules synced
- **Expo push notifications** — uses expo-notifications + Expo Push API (https://exp.host); device tokens stored in device_tokens table. No Firebase needed.
- **No WorkManager/notifee** — using expo-notifications instead

### Cross-cutting gaps
- **No Jest tests anywhere** — zero `__tests__` directories
- **No SQLite local cache** — Zustand + AsyncStorage used instead (works for offline-first)
- **Only Finance + Garage have Supabase sync hooks** — Tasks, Equity, Personal are local-only
- **5/6 edge functions are scaffolds** — only `_shared/groq.ts` has real logic
- **No WorkManager/notifee** — using expo-notifications instead

---

## Active Phase

**Currently Active: Phase 5 → Phase 6 — SMS AI fallback → AI Assistants**

Priority order:
1. Complete Phase 5 edge function (ai-sms-parse — replace scaffold with real Claude parsing)
2. Wire Phase 7 (Personal) to Supabase sync
3. Phase 6 (AI Assistants) — T&C RAG + portfolio recs after other edge functions are done

---

## Architecture (Revised — ADR-008)

```
Mobile (RN) ─── direct ──► Supabase (Postgres + Auth + Storage + Realtime + pg_cron)
                              │
                              └── Edge Functions (Deno/TS) ──► Claude API / Kite
```

**No FastAPI.** CRUD goes to Supabase PostgREST. AI calls go through Edge Functions. All secrets live in Supabase, never in the app.

Cron: pg_cron at 15:00 UTC (8:30 PM IST) calls portfolio-snapshot via pg_net.

Edge functions deployed: kite-callback, kite-holdings-sync, portfolio-snapshot (all production-ready). Scaffolds: ai-sms-parse, ai-tnc-query, ai-portfolio-recommend.

---

## Critical Rules (Summary — Full List in BOUNDARIES.md)

- **App name is Meridian** — use this name in all screen titles, app bar headers, and metadata
- **Dark mode first** — implement ALL screens using dark tokens from `DESIGN.md`. Never use light colors during Phase 0–8
- **Money = paise integers always** (₹1 = 100 paise). Never floats.
- **Never AsyncStorage for tokens** — use `react-native-keychain`
- **Never touch `transactions` table structure** without migration + updating `ARCHITECTURE.md`
- **Claude API only from Edge Functions** — never from mobile app directly
- **Every Claude response must include disclaimer** — see `SAFETY.md` Section 4
- **Canonical screens = Meridian: prefixed in Stitch** — for screens without that prefix, use layout only and apply dark tokens

---

## Key Commands

```bash
# Mobile Android dev build
cd mobile && npm run android

# Create new Supabase migration
supabase migration new <description>

# Push migrations + deploy config changes
supabase db push

# Deploy Edge Functions
supabase functions deploy <fn-name>

# Trigger portfolio snapshot manually
curl -X POST https://rkmouoglorsnijmemmcd.supabase.co/functions/v1/portfolio-snapshot

# Run mobile linting + typecheck
cd mobile && npm run lint && npm run typecheck

# Set Edge Function secrets
supabase secrets set GROQ_API_KEY=gsk_...
```

---

## If You're Unsure

1. Check `PRD.md` for product intent
2. Check `ARCHITECTURE.md` for technical decisions
3. Check `BOUNDARIES.md` for what's off-limits
4. Check `ADR/ADR-008-baas-first.md` for the architecture decision
5. If a BOUNDARY needs to change, **stop and ask** — don't work around it
