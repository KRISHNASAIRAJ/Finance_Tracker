# SMS Parser Specification
## Personal Tracker App · Krishna's Tracker

> Governs the SMS auto-capture feature (Phase 4).  
> All parsing logic lives in `backend/app/services/sms_parser_service.py` (rules engine) and `backend/app/ai/sms_parser.py` (Claude fallback).

---

## Overview

The SMS parser follows a two-stage approach:
1. **Stage 1 (Regex rules engine)**: Handles ~90% of standard bank SMS formats deterministically. No API cost.
2. **Stage 2 (Claude API fallback)**: Called only when Stage 1 fails or returns low confidence. See `SAFETY.md` Use Case C.

---

## Sender ID Allowlist

Only process SMS from these sender IDs (case-insensitive):

```python
BANK_SENDER_ALLOWLIST = {
    # HDFC
    'HDFCBK', 'HDFCCC', 'HDFC-BANK',
    # ICICI
    'ICICIB', 'ICICIC', 'ICICI',
    # SBI
    'SBICRD', 'SBIBNK', 'SBIINB',
    # Axis
    'AXISBK', 'AXISCC', 'AXIS',
    # Kotak
    'KOTAKB', 'KOTAKC', 'KOTAK',
    # IndusInd
    'INDUSB', 'INDUS',
    # Yes Bank
    'YESBK', 'YESBNK',
    # Paytm
    'PAYTMB', 'PAYTM',
    # Add more as needed
}
```

---

## Output Schema

The parser (both stages) must return this structure:

```python
@dataclass
class SMSParseResult:
    amount: int | None          # in paise
    merchant: str | None        # merchant/description string
    card_last4: str | None      # 4-digit string
    account_last4: str | None   # 4-digit string (for bank debit SMS)
    transaction_type: Literal['debit', 'credit'] | None
    confidence: float           # 0.0 to 1.0
    parse_stage: Literal['regex', 'groq']
    raw_sms_hash: str           # SHA-256 of raw SMS (for audit, not the SMS itself)
```

**Confidence threshold**: If `confidence < 0.7`, do NOT auto-fill — show manual entry form instead.

---

## Stage 1: Regex Rules Engine

### Pattern Library

```python
# backend/app/services/sms_parser_service.py

import re
from decimal import Decimal

# Amount patterns (handles ₹, Rs, INR, and comma-separated values)
AMOUNT_PATTERNS = [
    r'(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)',
    r'([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|INR|₹)',
    r'(?:debited|credited|spent|paid)\s+(?:for\s+)?(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)',
]

# Card last 4 digits
CARD_LAST4_PATTERNS = [
    r'card\s+(?:ending|no\.?|number)?\s*[xX*]+(\d{4})',
    r'[xX]{4}\s*(\d{4})',
    r'ending\s+(?:with\s+)?(\d{4})',
]

# Account last 4 digits
ACCOUNT_LAST4_PATTERNS = [
    r'a/c\s+[xX*]+(\d{4})',
    r'account\s+(?:no\.?\s*)?[xX*]+(\d{4})',
    r'acct\s+[xX*]+(\d{4})',
]

# Transaction type
DEBIT_KEYWORDS = ['debited', 'spent', 'paid', 'purchase', 'withdrawn', 'deducted']
CREDIT_KEYWORDS = ['credited', 'received', 'refund', 'cashback', 'deposited']

# Merchant extraction (what comes after "at" or "to")
MERCHANT_PATTERNS = [
    r'at\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|$)',
    r'to\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|$)',
    r'for\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\.|$)',
]

def parse_amount(text: str) -> tuple[int | None, float]:
    """Returns (amount_in_paise, confidence)"""
    for pattern in AMOUNT_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            amount = Decimal(amount_str)
            paise = int(amount * 100)
            return paise, 0.95
    return None, 0.0

def determine_transaction_type(text: str) -> tuple[str | None, float]:
    text_lower = text.lower()
    for kw in DEBIT_KEYWORDS:
        if kw in text_lower:
            return 'debit', 0.9
    for kw in CREDIT_KEYWORDS:
        if kw in text_lower:
            return 'credit', 0.9
    return None, 0.0
```

### Known Bank SMS Templates (Test Cases)

These are representative formats. The parser must handle all of them:

```
# HDFC Credit Card
"Rs.450.00 spent on HDFC Bank Credit Card ending 1234 at SWIGGY ORDER on 17-07-26. Avl Lmt: Rs.49550."

# HDFC Bank Debit
"Rs 1500 debited from A/c XX9876 on 17-Jul-26 to UPI/MERCHANT/ref. Bal:Rs 23,450"

# ICICI Credit Card
"ICICI Bank Credit Card XX5678: Rs 2999.00 spent at AMAZON on 17-Jul-2026. Avbl limit Rs 47001."

# SBI Debit
"Your A/c no. XX4321 is debited by INR 500.00 on 17-07-26 & credited to UPI/MERCHANT. Bal INR 15000.00"

# Axis Bank
"₹850 debited from Axis Bank A/c ending 2345 for ZOMATO on 17Jul26. Avl Bal:₹12,500"

# Kotak
"Kotak Bank: Rs.1200 spent using your credit card XX7890 at MYNTRA on 17-Jul-2026."

# Paytm Bank
"Your Paytm Payments Bank A/c XX3456 is debited with Rs.300.00 at PETROL PUMP on 17/07/2026"
```

---

## Stage 2: Claude API Fallback

Only invoked when Stage 1 returns `confidence < 0.7`.

See `SAFETY.md` — Use Case C for:
- Pre-processing requirements (sanitize phone numbers)
- Required output schema
- Max tokens and temperature settings
- Rate limiting (50 calls/day)

### Fallback Prompt (stored in `backend/app/ai/prompts/sms_parser.py`)

```python
SYSTEM_PROMPT = """You are an SMS parser for Indian bank transaction messages.
Extract structured data from the SMS text provided.
Return ONLY valid JSON matching the schema. Do not include any explanation.

Output schema:
{
  "amount": <integer paise, null if not found>,
  "merchant": <string or null>,
  "card_last4": <4-digit string or null>,
  "account_last4": <4-digit string or null>,
  "transaction_type": <"debit" | "credit" | null>,
  "confidence": <float 0.0-1.0>
}

Rules:
- amount is in PAISE (multiply rupees by 100)
- merchant is the business/payee name only, not the bank name
- confidence reflects how certain you are of the extraction
"""

USER_TEMPLATE = "Parse this bank SMS:\n{sanitized_sms_text}"
```

---

## Confidence Scoring Matrix

| Confidence | Action |
|---|---|
| ≥ 0.9 | Auto-fill all fields in confirm screen; user just taps [Add] |
| 0.7 – 0.89 | Pre-fill fields but highlight uncertain ones in yellow; user reviews |
| < 0.7 | Show blank manual entry form with a note "Could not auto-read SMS" |

---

## Suppressed Senders

If the user taps "Ignore & don't ask for this sender again":
```python
# Store in SQLite (local preference)
suppressed_senders table:
  - sender_id TEXT
  - suppressed_at TIMESTAMPTZ
```
Future SMS from suppressed senders are silently discarded without notification.

---

## Testing Checklist (Phase 4 QA)

Before shipping Phase 4, the parser must correctly handle:
- [ ] HDFC credit card debit SMS
- [ ] HDFC bank account debit via UPI
- [ ] ICICI credit card purchase SMS
- [ ] SBI account debit SMS
- [ ] Axis bank debit SMS
- [ ] Kotak credit card SMS
- [ ] Refund/credit SMS (transaction_type = 'credit')
- [ ] SMS with comma-separated amounts (e.g., "Rs 1,500.00")
- [ ] SMS with Unicode ₹ symbol
- [ ] Promotional SMS (should be ignored — no amount/card pattern)
- [ ] OTP SMS (should be ignored — no transaction keywords)
