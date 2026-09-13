# API Contracts
## Meridian · Personal Life Tracker

> **Architecture (ADR-008):** There is no custom REST server. Two API surfaces exist:  
> 1. **Supabase PostgREST** — CRUD on tables, auto-generated from Postgres, RLS-enforced per `auth.uid()`.  
> 2. **Supabase Edge Functions** — invoked via `supabase.functions.invoke('<name>', { body })` from mobile/web; used for anything requiring secrets or external APIs (Groq, Kite, Yahoo/AMFI, Expo push).  
> Table/column reference: `docs/db-schema.md`. Data models: `ARCHITECTURE.md` Section 3.

---

## PostgREST CRUD (auto-generated)

All tables are accessed directly via `supabase-js`:

```typescript
// Select (RLS scopes rows to the signed-in user)
const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false });

// Insert / Upsert (sync queue uses per-entity ON_CONFLICT_TARGET)
await supabase.from('tasks').insert(task);
await supabase.from('vehicles').upsert(v, { onConflict: 'user_id,name' });

// Soft delete — status flags, never hard DELETE for financial rows
await supabase.from('transactions').update({ status: 'voided' }).eq('id', id);
```

Standard PostgREST query params apply (`.eq()`, `.gte()`, `.lte()`, `.order()`, `.limit()`, `.select()` column pruning).

---

## Edge Functions

All edge functions live in `supabase/functions/`, are Deno/TypeScript, and share the Groq client in `_shared/groq.ts` (text: `openai/gpt-oss-120b` / `openai/gpt-oss-20b`, vision: `qwen/qwen3.6-27b`).

### ai-tnc-query — Card T&C chat (RAG)
```typescript
// Invoke
supabase.functions.invoke('ai-tnc-query', {
  body: { cardId: string, question: string }   // question sanitized, ≤500 chars
})
// Response data:
{
  answer: string,        // grounded in CARD_KNOWLEDGE or uploaded doc chunks
  disclaimer: "Based on the document you uploaded. Verify current terms directly with your bank."
}
// Rate limit: 30/day. Errors: { error: 'RATE_LIMITED' | 'AI_UNAVAILABLE' | 'INVALID_QUESTION' }
```

### ai-portfolio-recommend — Portfolio recs (goal-aware)
```typescript
supabase.functions.invoke('ai-portfolio-recommend', {
  body: { includeGoals?: boolean }
})
// Response data:
{
  recommendations: string,   // plain-language, percentages only (no rupee amounts)
  disclaimer: "For informational purposes only. This is not investment advice.",
  generatedAt: string, cached?: boolean
}
// Rate limit: 5/day → returns last cached response when exceeded.
```

### ai-meal-log — Meal photo analysis + chat manage mode
```typescript
// Photo analysis (vision model)
supabase.functions.invoke('ai-meal-log', {
  body: { imageBase64: string, context?: string }
})
// → { items: [{ name, calories, protein, carbs, fat, confidence }] }

// Chat manage mode (add/delete/modify proposed changes — user confirms in UI)
supabase.functions.invoke('ai-meal-log', {
  body: { mode: 'manage', request: string, todayLog: MealEntry[] }
})
// → { proposedChanges: [{ action: 'add'|'delete'|'modify', entry, reason }] }
```

### ai-meal-suggest — Meal suggestions
```typescript
supabase.functions.invoke('ai-meal-suggest', { body: { macrosTarget?, excludeRecent?: boolean } })
// → { suggestions: [{ name, macros, reason }] }
```

### ai-daily-report — Evening/morning Groq reports (cron-driven)
```typescript
// Triggered by pg_cron: evening 16:00 UTC (9:30 PM IST), morning 03:00 UTC (8:30 AM IST)
// Manual: POST { mode: 'evening' | 'morning' } — idempotent per (user, date, mode)
// Inputs to Groq: task names/status, meal names + notes. NO financial data.
// → sends Expo push; report stored for in-app Daily Report screen.
```

### ai-sleep-insight — Groq sleep coach
```typescript
// Caller passes last 14 nights as context (function never reads DB — RLS stays client-side)
supabase.functions.invoke('ai-sleep-insight', {
  body: { nights: [{ startTime, endTime, durationHours, quality, interruptions }] }
})
// → { insight: string, disclaimer } — one short insight + at most one actionable tip
// Rate limit: 20/day. No medical advice.
```

### kite-holdings-sync / kite-callback — Kite Connect (Zerodha)
```typescript
// OAuth: kite-callback handles Zerodha redirect (state-param verified) → stores tokens in kite_tokens
// Sync (read-only): supabase.functions.invoke('kite-holdings-sync', { body: {} })
// → upserts equity + MF holdings with source 'kite_sync'. Never places orders.
```

### refresh-portfolio-prices — Live quotes
```typescript
// pg_cron pre-snapshot + manual refresh from Wealth hero card
// Fetches Yahoo Finance (equity/ETF) + AMFI (MF NAV) → updates current_price, prev_close per holding
```

### portfolio-snapshot — 8:30 PM IST cron
```typescript
// pg_cron 15:00 UTC → computes total_value, day_change, day_change_pct per user
// Unchanged values slide snapshot date forward (no duplicate rows)
// Sends Expo push summary ("₹XL · +1.2% today") — no account-level detail
```

---

## Error Handling Convention

Edge functions return `{ error: '<CODE>' }` with HTTP 4xx/5xx:

| Code | Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `INVALID_QUESTION` | 400 | Prompt-injection pattern or oversize input rejected |
| `RATE_LIMITED` | 429 | Per-use-case daily cap exceeded |
| `AI_UNAVAILABLE` | 503 | Groq timeout/error (no auto-retry) |

AI failures degrade gracefully in-app: friendly error message + manual entry fallback where applicable. Disclaimers are appended server-side if missing from the model response (see `SAFETY.md`).
