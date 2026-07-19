# SAFETY.md — AI Safety & Data Privacy Guardrails
## Personal Tracker App · Krishna's Tracker

> **Read this file before touching any file in `backend/app/ai/`**  
> These rules govern all AI/LLM interactions in this app. Violations can expose private financial data, create liability for unlicensed financial advice, or inflate API costs.

---

## 1. AI Architecture Principles

### 1.1 AI Is a Tool, Not an Authority
- Claude API outputs are **informational suggestions only** — the app never presents them as decisions
- All AI-generated content that reaches the user must have a visible disclaimer (see Section 4)
- The human user (Krishna) is always the final decision-maker for financial and investment actions

### 1.2 Backend-Only AI Calls
All Claude API calls **must** originate from the FastAPI backend. The mobile app never calls Claude directly.

```
❌ WRONG:  Mobile App → Claude API
✅ CORRECT: Mobile App → FastAPI Backend → Claude API
```

Rationale: API keys are never exposed to the device, network calls are auditable, rate limiting can be enforced server-side.

### 1.3 Minimal Data Principle
Send the minimum data necessary to Claude for each use case. Aggressively strip or aggregate data before building prompts.

---

## 2. Permitted AI Use Cases & Prompting Rules

### 2.1 Use Case A: Card T&C Q&A (RAG)

**What it does**: Answers user questions about a specific credit card's terms and conditions, grounded in the user's uploaded document.

**Allowed inputs to Claude**:
- Retrieved text chunks from the user's uploaded T&C document (already preprocessed)
- The user's natural language question
- System context (role, output format instructions)

**Prohibited inputs to Claude**:
- Raw card numbers
- Current outstanding balances
- Transaction history
- Personal user information

**Required system prompt template** (`backend/app/ai/prompts/tnc_qa.py`):
```python
SYSTEM_PROMPT = """You are a helpful assistant that answers questions about credit card terms and conditions.
You ONLY use information from the document excerpts provided below.
If the answer is not found in the excerpts, say "I couldn't find that information in the document you uploaded."
Never make up fees, interest rates, or terms that are not in the provided excerpts.
Always end your response with: "Note: Verify current terms directly with your bank, as documents may be outdated."
"""
```

**Max tokens**: 1024 output tokens per call
**Temperature**: 0.1 (low — factual retrieval, not creative)

---

### 2.2 Use Case B: Portfolio Recommendations

**What it does**: Provides high-level rebalancing and allocation suggestions based on the user's current portfolio and goals.

**Allowed inputs to Claude**:
- Aggregated portfolio summary: `{symbol, type, current_value_pct, avg_return_pct}` — amounts in percentages, not rupees
- Investment goals: `{goal_name, target_date, risk_level, linked_holdings_pct}`
- Basic market context (if injected): general market condition labels only

**Prohibited inputs to Claude**:
- Absolute rupee amounts (send percentages only — this protects exact financial exposure)
- Account numbers, Demat account ID, PAN
- Raw transaction history
- Exact buy prices that reveal wealth level

**Required system prompt template** (`backend/app/ai/prompts/portfolio.py`):
```python
SYSTEM_PROMPT = """You are a portfolio analysis assistant.
Analyze the provided portfolio allocation and investment goals.
Provide general rebalancing observations and risk considerations.
IMPORTANT RULES:
- Never recommend specific stocks or funds by name as "buys"
- Never predict specific returns or guarantee outcomes
- Always frame suggestions as questions to consider, not directives
- End every response with: "This is for informational purposes only and is not financial advice. Consult a SEBI-registered advisor for investment decisions."
"""
```

**Max tokens**: 800 output tokens per call
**Temperature**: 0.3
**Rate limit**: 5 calls per day (backend enforced)

---

### 2.3 Use Case C: SMS Parsing Fallback

**What it does**: Extracts structured data from a bank SMS when regex rules fail.

**Allowed inputs to Groq**:
- The raw SMS text (single SMS only)
- The expected output JSON schema

**Pre-processing required before sending**:
```python
def sanitize_sms_for_ai(sms_text: str) -> str:
    """Strip phone numbers and email addresses from SMS before sending to AI."""
    import re
    # Remove phone numbers
    text = re.sub(r'\b\d{10,12}\b', '[PHONE]', sms_text)
    # Remove email-like patterns  
    text = re.sub(r'[\w.]+@[\w.]+\.\w+', '[EMAIL]', text)
    return text
```

**Required output schema** (Groq must return this JSON structure):
```json
{
  "amount": 450,              // integer in paise, null if not found
  "merchant": "Swiggy",       // string, null if not found
  "card_last4": "1234",       // string 4 digits, null if not found
  "transaction_type": "debit", // "debit" | "credit" | null
  "confidence": 0.95          // 0.0 to 1.0
}
```

**If confidence < 0.7**: Discard the parse result; show user a manual entry prompt instead of an auto-fill.

**Max tokens**: 256 output tokens per call
**Temperature**: 0.0 (deterministic structured extraction)
**Rate limit**: 50 calls per day (backend enforced) — regex handles 90% of cases

---

## 3. Data Sanitization Checklist

Before every Groq API call, verify:

```
[ ] No raw account numbers in the prompt
[ ] No full credit card numbers in the prompt
[ ] No CVV or PIN in the prompt
[ ] No PAN/Aadhaar numbers in the prompt
[ ] No UPI IDs that could identify the user externally
[ ] Monetary amounts are in percentages (portfolio use case) or paise with no user identity link (SMS use case)
[ ] SMS text has been pre-processed through sanitize_sms_for_ai()
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

Additionally, every Claude response in this screen must end with the disclaimer (enforced by the system prompt).

### 4.3 Disclaimer Bypass Prevention
- The disclaimer UI components must not be dismissible
- The disclaimer text must not be user-configurable
- If Claude's response does not end with the required disclaimer text, the backend must append it before returning the response to the client

---

## 5. Prompt Injection Defense

### 5.1 T&C Assistant Defense
User questions for the T&C assistant must be sanitized before being passed to Claude:

```python
MAX_QUESTION_LENGTH = 500  # characters

def sanitize_user_question(question: str) -> str:
    """Prevent prompt injection attempts in T&C Q&A."""
    # Truncate to max length
    question = question[:MAX_QUESTION_LENGTH]
    
    # Remove common injection patterns
    injection_patterns = [
        r'ignore\s+previous\s+instructions',
        r'forget\s+your\s+system\s+prompt',
        r'you\s+are\s+now',
        r'act\s+as\s+(if\s+)?',
        r'disregard\s+(all\s+)?previous',
    ]
    
    for pattern in injection_patterns:
        if re.search(pattern, question, re.IGNORECASE):
            raise ValueError("Invalid question format")
    
    return question.strip()
```

### 5.2 Response Validation
Before returning any Claude response to the mobile client, validate:
- Response does not contain raw numbers that look like account numbers (16-digit sequences)
- Response does not contain content that contradicts the required disclaimer
- Response length is within expected range (very short = likely error, very long = may contain hallucinated content)

---

## 6. Rate Limiting & Cost Controls

| Use Case | Daily Limit | Monthly Estimate | Action on Limit Hit |
|---|---|---|---|
| T&C Q&A | 30 calls/day | ~900 calls | Return friendly "limit reached" message |
| Portfolio recommendations | 5 calls/day | ~150 calls | Return last cached response with timestamp |
| SMS parsing fallback | 50 calls/day | ~1,500 calls | Fall through to manual entry prompt |

**Cost estimation** (Llama 3.3 70B on Groq: free tier with 7K req/day, 30 req/min; Llama 3.1 8B: free tier with generous limits):
- T&C Q&A: ~2K tokens/call × 30 × 30 days ≈ $0/month (free tier)
- Portfolio: ~1K tokens/call × 5 × 30 days ≈ $0/month (free tier)
- SMS parsing: ~200 tokens/call × 50 × 30 days ≈ $0/month (free tier)
- **Estimated total: $0/month** — Groq free tier covers all current use cases

### 6.1 Rate Limit Implementation
```python
# backend/app/ai/rate_limiter.py
# Use Redis or a simple PostgreSQL table to track daily usage per use_case
# Reset at midnight IST (UTC+5:30)

async def check_rate_limit(use_case: str, limit: int) -> bool:
    """Returns True if the call is allowed, False if limit exceeded."""
    today_ist = get_today_ist()
    count = await db.query("SELECT count FROM ai_usage WHERE use_case=$1 AND date=$2", 
                           use_case, today_ist)
    return count < limit
```

---

## 7. Logging & Audit Rules

### 7.1 What to Log
```python
# Log this for every AI call:
{
    "timestamp": "2026-07-17T18:30:00Z",
    "use_case": "tnc_qa",
    "tokens_used": 1247,
    "response_length": 342,
    "latency_ms": 1823,
    "success": true
}
```

### 7.2 What NEVER to Log
- The actual user question (T&C or portfolio — contains intent data)
- The Claude response content
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
| Claude API timeout (>10s) | Return error message: "AI assistant is temporarily unavailable" — do NOT retry automatically |
| Claude API error (4xx/5xx) | Return error message + offer manual data entry where applicable |
| Claude returns response without disclaimer | Backend appends disclaimer before sending to client |
| Rate limit exceeded | Return cached response (portfolio) or "try again tomorrow" message |
| SMS parse confidence < 0.7 | Show manual entry form pre-filled with partial data (user completes) |
| T&C document not yet processed | Return "Document is still being processed. Try again in a few minutes." |

---

## 9. Security Headers & Transport

- All Groq API calls from the backend must use **HTTPS**
- The `GROQ_API_KEY` is loaded only from environment variables — never hardcoded
- API key rotation: if the key is compromised, rotate immediately and update the VPS/Railway environment

---

## 10. Future AI Expansion Rules

If a new AI feature is proposed in a future phase, it must clear **all** of the following gates before implementation:

1. ✅ Documented as a new use case in this file with input/output spec
2. ✅ System prompt written and reviewed
3. ✅ Disclaimer text defined and approved
4. ✅ PII sanitization implemented and tested with at least 5 adversarial inputs
5. ✅ Rate limit defined and implemented
6. ✅ `BOUNDARIES.md` updated to reflect the new permitted use
7. ✅ ADR written explaining why this AI use case is necessary

**No new AI calls may be added without human approval of the above checklist.**
