# SAFETY.md — AI Safety & Data Privacy Guardrails
## Meridian · Personal Life Tracker

> **Read this file before touching any file in `supabase/functions/`**  
> These rules govern all AI/LLM interactions in this app. Violations can expose private financial data, create liability for unlicensed financial advice, or inflate API costs.

---

## 1. AI Architecture Principles

### 1.1 AI Is a Tool, Not an Authority
- Groq API outputs are **informational suggestions only** — the app never presents them as decisions
- All AI-generated content that reaches the user must have a visible disclaimer (see Section 4)
- The human user (Krishna) is always the final decision-maker for financial and investment actions

### 1.2 Edge-Function-Only AI Calls
All Groq API calls **must** originate from Supabase Edge Functions. The mobile and web apps never call Groq directly.

```
❌ WRONG:  Mobile/Web App → Groq API
✅ CORRECT: Mobile/Web App → supabase.functions.invoke → Edge Function → Groq API
```

Rationale: API keys are never exposed to the device, network calls are auditable, rate limiting can be enforced server-side.

### 1.3 Minimal Data Principle
Send the minimum data necessary to Groq for each use case. Aggressively strip or aggregate data before building prompts.

---

## 2. Permitted AI Use Cases & Prompting Rules

Shared Groq client: `supabase/functions/_shared/groq.ts` — text models `openai/gpt-oss-120b` (default) / `openai/gpt-oss-20b` (fast), vision model `qwen/qwen3.6-27b`.

### 2.1 Use Case A: Card T&C Q&A (RAG) — `ai-tnc-query`

**What it does**: Answers user questions about a specific credit card's terms and conditions, grounded in the user's uploaded document.

**Allowed inputs to Groq**:
- Retrieved text chunks from the user's uploaded T&C document (already preprocessed)
- The user's natural language question
- System context (role, output format instructions)

**Prohibited inputs to Groq**:
- Raw card numbers
- Current outstanding balances
- Transaction history
- Personal user information

**Required system prompt rules** (in `supabase/functions/ai-tnc-query/index.ts`):
- Answer ONLY from the provided document excerpts
- If not found: "I couldn't find that information in the document you uploaded."
- Never make up fees, interest rates, or terms
- Always end with: "Note: Verify current terms directly with your bank, as documents may be outdated."

**Max tokens**: 1024 output tokens per call · **Temperature**: 0.1 (factual retrieval)

---

### 2.2 Use Case B: Portfolio Recommendations — `ai-portfolio-recommend`

**What it does**: Provides high-level rebalancing and allocation suggestions based on the user's current portfolio and goals.

**Allowed inputs to Groq**:
- Aggregated portfolio summary: `{symbol, type, current_value_pct, avg_return_pct}` — amounts in percentages, not rupees
- Investment goals: `{goal_name, target_date, risk_level, linked_holdings_pct}`
- Basic market context (if injected): general market condition labels only

**Prohibited inputs to Groq**:
- Absolute rupee amounts (send percentages only — this protects exact financial exposure)
- Account numbers, Demat account ID, PAN
- Raw transaction history
- Exact buy prices that reveal wealth level

**Required system prompt rules**:
- Never recommend specific stocks or funds by name as "buys"
- Never predict specific returns or guarantee outcomes
- Always frame suggestions as questions to consider, not directives
- End with: "This is for informational purposes only and is not financial advice. Consult a SEBI-registered advisor for investment decisions."

**Max tokens**: 800 · **Temperature**: 0.3 · **Rate limit**: 5 calls/day (edge-function enforced)

---

### 2.3 Use Case C: Meal AI — `ai-meal-log`, `ai-meal-suggest`

**What it does**: (a) Analyzes meal photos to estimate macros; (b) chat-based add/delete/modify of logged meals via proposed changes requiring user confirmation; (c) suggests meals.

**Allowed inputs**:
- Meal photo (vision model) with natural-language context
- Today's logged meal entries (names + macros, no PII)
- User's request text (sanitized)

**Prohibited inputs**:
- Any non-food personal data
- Financial data of any kind

**Rules**:
- `manageMode` responses are **proposals only** — the app must show a review card and apply changes only after explicit user confirmation
- Macro estimates must be labeled as AI estimates in the UI

---

### 2.4 Use Case D: Daily Reports — `ai-daily-report`

**What it does**: Evening summary (9:30 PM IST) of the day's spends/tasks/meals + next-morning plan (8:30 AM IST), delivered via Expo push.

**Allowed inputs**:
- Aggregated day summaries (total spend by category, tasks completed, meals logged) — totals, not individual transaction details
- Schedule context (what's due tomorrow)

**Prohibited inputs**: account numbers, card numbers, raw transaction notes.

**Rules**:
- Push payloads carry only a short summary string + trigger ID (no account-level detail)
- Report generation failure must surface an honest error in-app, never a fabricated report

---

## 3. Data Sanitization Checklist

Before every Groq API call, verify:

```
[ ] No raw account numbers in the prompt
[ ] No full credit card numbers in the prompt
[ ] No CVV or PIN in the prompt
[ ] No PAN/Aadhaar numbers in the prompt
[ ] No UPI IDs that could identify the user externally
[ ] Monetary amounts are in percentages (portfolio use case) or anonymized
[ ] Prompt length is within token limits for the use case
[ ] System prompt contains the required disclaimer instruction
```

---

## 4. Mandatory Disclaimer Rules

### 4.1 Card T&C Disclaimer
Must appear **at the end of every response** from the T&C assistant. Render in the UI as a small italic note below the response bubble.

```
"Note: Based on the document you uploaded. Verify current terms directly with your bank."
```

### 4.2 Portfolio Recommendation Disclaimer
Must appear **visibly at the top of the AI Recommendations screen** (not just embedded in the response). Render as a distinct card/banner.

```
"⚠️ For informational purposes only. This is not investment advice. 
Consult a SEBI-registered investment advisor before making investment decisions."
```

Additionally, every Groq response in this screen must end with the disclaimer (enforced by the system prompt).

### 4.3 Meal / Daily Report Disclaimer
AI-generated macros and reports must be visibly labeled as AI estimates in the UI (e.g. "AI-generated estimate — verify before relying on it").

### 4.4 Disclaimer Bypass Prevention
- The disclaimer UI components must not be dismissible
- The disclaimer text must not be user-configurable
- If Groq's response does not end with the required disclaimer text, the Edge Function must append it before returning the response to the client

---

## 5. Prompt Injection Defense

### 5.1 Input Sanitization
User questions / chat inputs must be sanitized before being passed to Groq:

```
MAX_QUESTION_LENGTH = 500  # characters — truncate

Reject (raise/escape) common injection patterns:
  ignore\s+previous\s+instructions
  forget\s+your\s+system\s+prompt
  you\s+are\s+now
  act\s+as\s+(if\s+)?
  disregard\s+(all\s+)?previous
```

### 5.2 Response Validation
Before returning any Groq response to the mobile/web client, validate:
- Response does not contain raw numbers that look like account numbers (16-digit sequences)
- Response does not contain content that contradicts the required disclaimer
- Response length is within expected range (very short = likely error, very long = may contain hallucinated content)

---

## 6. Rate Limiting & Cost Controls

| Use Case | Daily Limit | Action on Limit Hit |
|---|---|---|
| T&C Q&A | 30 calls/day | Return friendly "limit reached" message |
| Portfolio recommendations | 5 calls/day | Return last cached response with timestamp |
| Meal AI | Capped per session | Return friendly "limit reached" message |
| Daily reports | Fixed schedule (2/day) | Skip + log |

**Cost estimation** (Groq free tier — generous per-model daily request limits):
- All current use cases ≈ **$0/month** on the free tier
- Keep prompts small; prefer `openai/gpt-oss-20b` for fast/simple tasks, `openai/gpt-oss-120b` for complex reasoning

### 6.1 Rate Limit Implementation
```typescript
// supabase/functions/<fn>/index.ts — use a Postgres table to track daily usage per use_case
// Reset at midnight IST (UTC+5:30). Shared pattern in _shared/groq.ts consumers.
```

---

## 7. Logging & Audit Rules

### 7.1 What to Log
```json
{
  "timestamp": "2026-09-13T18:30:00Z",
  "use_case": "tnc_qa",
  "tokens_used": 1247,
  "response_length": 342,
  "latency_ms": 1823,
  "success": true
}
```

### 7.2 What NEVER to Log
- The actual user question (contains intent data)
- The Groq response content
- The retrieved T&C chunks (contains document content)
- Any monetary amounts
- Any account identifiers

### 7.3 Log Retention
- AI usage logs: 90 days maximum, then delete
- No AI log data is backed up to third-party monitoring tools

---

## 8. Failure Modes & Fallbacks

| Failure | Fallback Behavior |
|---|---|
| Groq API timeout (>10s) | Return error message: "AI assistant is temporarily unavailable" — do NOT retry automatically |
| Groq API error (4xx/5xx) | Return error message + offer manual data entry where applicable |
| Groq returns response without disclaimer | Edge Function appends disclaimer before sending to client |
| Rate limit exceeded | Return cached response (portfolio) or "try again tomorrow" message |
| T&C document not yet processed | Return "Document is still being processed. Try again in a few minutes." |
| Daily report generation fails | Surface honest error in-app — never fabricate a report |

---

## 9. Security Headers & Transport

- All Groq API calls from Edge Functions use **HTTPS**
- The `GROQ_API_KEY` is loaded only from Supabase secrets (`supabase secrets set`) — never hardcoded
- API key rotation: if the key is compromised, rotate immediately via `supabase secrets set GROQ_API_KEY=...` and redeploy affected functions

---

## 10. Future AI Expansion Rules

If a new AI feature is proposed, it must clear **all** of the following gates before implementation:

1. ✅ Documented as a new use case in this file with input/output spec
2. ✅ System prompt written and reviewed
3. ✅ Disclaimer text defined and approved
4. ✅ PII sanitization implemented and tested with at least 5 adversarial inputs
5. ✅ Rate limit defined and implemented
6. ✅ `BOUNDARIES.md` updated to reflect the new permitted use
7. ✅ ADR written explaining why this AI use case is necessary

**No new AI calls may be added without human approval of the above checklist.**
