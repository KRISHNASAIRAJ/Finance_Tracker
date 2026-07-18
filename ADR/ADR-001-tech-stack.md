# ADR-001: Tech Stack Selection
## Status: Accepted · Date: 2026-07-17

## Context
Needed a cross-platform mobile app (Android-first, iOS later) with a backend capable of running cron jobs and making AI API calls. Evaluated React Native, Flutter, and Next.js (PWA).

## Decision
**React Native (TypeScript) + FastAPI (Python) + PostgreSQL**

## Reasoning

| Option | Pros | Cons | Decision |
|---|---|---|---|
| React Native | Large ecosystem, TypeScript, familiar JS patterns, good Android support | Bridge overhead in old arch | ✅ Chosen |
| Flutter | Native performance, single codebase | Dart learning curve, smaller ecosystem for financial integrations | ❌ Rejected |
| Next.js PWA | Web skills | No SMS read, no Health Connect, no native push | ❌ Rejected |
| FastAPI | Async Python, auto OpenAPI docs, Pydantic, great AI library support | Requires separate hosting | ✅ Chosen |
| NestJS | TypeScript end-to-end | JS not ideal for AI/ML ecosystem | ❌ Rejected |
| Supabase (PostgreSQL) | Managed DB + auth + storage, free tier, pgvector support | Vendor dependency | ✅ Chosen |

## Consequences
- Must use React Native New Architecture (Fabric) for performance
- Python async ecosystem for AI calls (anthropic, httpx, asyncpg)
- Need to host FastAPI separately (not Supabase Edge Functions — too limited for cron)
