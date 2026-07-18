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
5. **Read `SAFETY.md`** before touching anything in `backend/app/ai/`

---

## Active Phase

**Currently Active: Phase 0 — Foundation**

Goal: Project scaffold, auth setup, PostgreSQL schema for all modules, shared `transactions` table.

Deliverables for Phase 0:
- [ ] React Native project initialized (TypeScript, New Architecture)
- [ ] FastAPI project initialized with folder structure per `ARCHITECTURE.md`
- [ ] Supabase project linked, env vars configured
- [ ] All Alembic migrations created for all tables in `ARCHITECTURE.md` Section 3
- [ ] Supabase Auth integrated in both backend and mobile
- [ ] Base API client (`mobile/src/services/api.ts`) with JWT interceptor
- [ ] SQLite local DB setup (op-sqlite or expo-sqlite)
- [ ] Zustand store scaffold for each module
- [ ] Navigation skeleton (React Navigation, all 5 tabs defined: Finance/Garage/Tasks/Investments/More, dark theme applied globally)
- [ ] Dark theme provider set up (`ThemeProvider` with `colors.dark` as default — see `DESIGN.md` React Native notes)
- [ ] `.env.example` present in both `mobile/` and `backend/`

---

## Critical Rules (Summary — Full List in BOUNDARIES.md)

- **App name is Meridian** — use this name in all screen titles, app bar headers, and metadata
- **Dark mode first** — implement ALL screens using dark tokens from `DESIGN.md`. Never use light colors during Phase 0–8
- **Money = paise integers always** (₹1 = 100 paise). Never floats.
- **Never AsyncStorage for tokens** — use `react-native-keychain`
- **Never touch `transactions` table structure** without Alembic migration + updating `ARCHITECTURE.md`
- **Google Fit = banned** — Health Connect only
- **Claude API only from backend** — never from mobile app directly
- **Every Claude response must include disclaimer** — see `SAFETY.md` Section 4
- **Canonical screens = Meridian: prefixed in Stitch** — for screens without that prefix, use layout only and apply dark tokens

---

## Key Commands

```bash
# Backend dev server
cd backend && uvicorn app.main:app --reload

# Mobile Android dev build
cd mobile && npm run android

# Create new DB migration
cd backend && alembic revision --autogenerate -m "add_xyz_table"

# Apply migrations
cd backend && alembic upgrade head

# Run backend tests
cd backend && pytest

# Run mobile linting + typecheck
cd mobile && npm run lint && npm run typecheck
```

---

## If You're Unsure

1. Check `PRD.md` for product intent
2. Check `ARCHITECTURE.md` for technical decisions
3. Check `BOUNDARIES.md` for what's off-limits
4. If a BOUNDARY needs to change, **stop and ask** — don't work around it
