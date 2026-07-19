# ADR-008: BaaS-First Architecture (Supersedes FastAPI)

## Status
Accepted · 2026-07-18

## Context
ADR-001 chose FastAPI + PostgreSQL (Supabase) architecture with React Native. The initial implementation created a full FastAPI backend with 14 SQLAlchemy models, 7 routers, and sync endpoints. However, for a **single-user personal-use app** (BOUNDARIES §5.3), a full backend server is over-engineered. Additionally, the mobile app was reverted to offline-only at commit `a2dbc81` after Supabase sync issues.

We needed to choose between:
1. Full FastAPI (current codebase) with Render/Fly.io hosting
2. Supabase Edge Functions for server-side logic only
3. No backend at all (everything on-device)

## Decision
**BaaS-first architecture: React Native + Supabase (Postgres + Auth + Storage + Edge Functions) — no FastAPI.**

The mobile app communicates directly with Supabase's PostgREST API for all CRUD operations, uses Supabase Auth for JWT-based authentication, Supabase Storage for file uploads, and Supabase Edge Functions (Deno/TypeScript) exclusively for operations requiring server-side secrets.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Native App (Android)             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  SQLite (offline-first) + Zustand stores           │   │
│  │  Sync queue → background-fetch (60-min KEEP)       │   │
│  └────────────────────┬─────────────────────────────┘   │
│                       │ HTTPS (+ JWT from Auth)          │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│                  Supabase Cloud                          │
│  ┌────────────────────▼─────────────────────────────┐   │
│  │  PostgreSQL 15 (postgrest + RLS per user_id)      │   │
│  │  + pg_cron (scheduled tasks)                      │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth (JWT + email/password)                      │   │
│  │  Storage (private buckets: tnc_documents)         │   │
│  │  Realtime (WebSocket subscription)                │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno/TypeScript, hold secrets):  │   │
│  │   · ai-tnc-query          (Card T&C RAG, Phase 6) │   │
│  │   · ai-portfolio-recommend(Phase 6)                │   │
│  │   · ai-sms-parse-fallback (Phase 5)                │   │
│  │   · kite-holdings-sync    (Phase 4, gated)        │   │
│  │   · portfolio-snapshot    (pg_cron trigger, Ph 4) │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## What happens to backend/?
The `backend/` folder (FastAPI, SQLAlchemy, Alembic, Pydantic) is archived to a `backend-fastapi-archived` Git branch and removed from `main`. The PostgreSQL schema moves to `supabase/migrations/`. The sync/upload/download routers are replaced by direct mobile-Supabase calls via `supabase-js`. AI routes become Supabase Edge Functions.

## Consequences

### Positive
- **$0 hosting** — Supabase free tier (500MB DB, 2M Edge Function invocations, 1GB storage) covers a single-user app
- **No server to maintain** — no Render/Fly.io deploy, no Python pip updates, no Uvicorn tuning
- **Simpler offline sync** — mobile writes to SQLite → queues → direct Supabase insert (one hop instead of mobile → FastAPI → Supabase)
- **End-to-end TypeScript** — mobile (React Native) + backend logic (Edge Functions) share TS types
- **Built-in RLS** — row-level security scopes all data to `auth.uid()`, future-proof for multi-user if needed
- **Realtime out of the box** — Supabase Realtime subscriptions for live data sync (Phase 4, 5)
- **Edge Functions solve the secret problem** — Claude API keys and Kite OAuth secrets live in Supabase Edge Function secrets, never in the mobile app (BOUNDARIES §3.2, §4.1 honored)

### Negative
- **Vendor lock-in increased** — moving from Supabase would require rewriting all CRUD + auth + RLS + edge functions
- **RLS learning curve** — the team needs to write PostgreSQL RLS policies instead of Python middleware
- **Edge Function cold start** — Deno Edge Functions have ~100-500ms cold start vs always-warm FastAPI
- **No Python AI ecosystem** — Edge Functions use Deno/TypeScript for Groq API calls
- **SMS parsing regex engine** — moves from Python to TypeScript (or Edge Function)

## Revises
- **ADR-001** (2026-07-17): "React Native + FastAPI + PostgreSQL" → "React Native + Supabase (no FastAPI)". The Supabase PostgreSQL choice remains. FastAPI is removed.

## Related ADRs (unchanged)
- ADR-002: Unified transactions table spine — identical schema, now managed via Supabase migrations
- ADR-003: Monetary amounts as paise integers — unchanged, enforced by INTEGER columns
- ADR-004: Offline-first with SQLite + WorkManager — adapted to sync directly to Supabase
- ADR-005: Notification via WorkManager/AlarmManager — unchanged
- ADR-006: AI scoping — Claude calls now in Edge Functions (honors BOUNDARIES §3.2)
