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

## Active Phase

**Currently Active: Phase 1 — Finance Tracker**

Goal: Wire Finance module to Supabase direct, add missing tables/columns per ARCHITECTURE.md spec, polish dashboard with real data.

Deliverables for Phase 1:
- [ ] Migration 0004: Add `linked_account_id` to transactions, `card_limit`/`bank` to credit_cards
- [ ] Migration 0005: Replace `receivables` with `lent_borrowed` table per ARCHITECTURE.md
- [ ] Wire `FinanceHomeScreen` stored transactions → Supabase direct (supabase-js)
- [ ] Category icon/color map shared module
- [ ] EditTransaction screen polish
- [ ] Credit Card detail screen

---

## Architecture (Revised — ADR-008)

```
Mobile (RN) ─── direct ──► Supabase (Postgres + Auth + Storage + Realtime + pg_cron)
                              │
                              └── Edge Functions (Deno/TS) ──► Claude API / Kite
```

**No FastAPI.** CRUD goes to Supabase PostgREST. AI calls go through Edge Functions. All secrets live in Supabase, never in the app.

---

## Critical Rules (Summary — Full List in BOUNDARIES.md)

- **App name is Meridian** — use this name in all screen titles, app bar headers, and metadata
- **Dark mode first** — implement ALL screens using dark tokens from `DESIGN.md`. Never use light colors during Phase 0–8
- **Money = paise integers always** (₹1 = 100 paise). Never floats.
- **Never AsyncStorage for tokens** — use `react-native-keychain`
- **Never touch `transactions` table structure** without migration + updating `ARCHITECTURE.md`
- **Google Fit = banned** — Health Connect only
- **Claude API only from Edge Functions** — never from mobile app directly
- **Every Claude response must include disclaimer** — see `SAFETY.md` Section 4
- **Canonical screens = Meridian: prefixed in Stitch** — for screens without that prefix, use layout only and apply dark tokens

---

## Key Commands

```bash
# Mobile Android dev build
cd mobile && npm run android

# Create new Supabase migration
supabase migration new <description> --project-ref rkmouoglorsnijmemmcd

# Deploy Edge Functions
supabase functions deploy ai-tnc-query --project-ref rkmouoglorsnijmemmcd

# Run mobile linting + typecheck
cd mobile && npm run lint && npm run typecheck

# Set Edge Function secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref rkmouoglorsnijmemmcd
```

---

## If You're Unsure

1. Check `PRD.md` for product intent
2. Check `ARCHITECTURE.md` for technical decisions
3. Check `BOUNDARIES.md` for what's off-limits
4. Check `ADR/ADR-008-baas-first.md` for the architecture decision
5. If a BOUNDARY needs to change, **stop and ask** — don't work around it
