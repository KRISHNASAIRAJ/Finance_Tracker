# ADR-003: Store Monetary Amounts as Integer Paise
## Status: Accepted · Date: 2026-07-17

## Context
Floating-point arithmetic is unreliable for financial calculations. `0.1 + 0.2 !== 0.3` in IEEE 754 — unacceptable for displaying account balances and net worth.

## Decision
**All monetary amounts stored as 64-bit integers representing paise (₹1 = 100 paise).**

## Implementation
- DB type: `BIGINT` (not DECIMAL, not FLOAT)
- Display layer: `formatCurrency(paise: number) => '₹' + (paise / 100).toFixed(2)`
- API layer: Pydantic schema uses `int` for all monetary fields with a `gt=0` validator
- Mobile layer: Zod schema validates `z.number().int().positive()` for all amount fields

## Consequences
- Max storable value: ~92 trillion rupees (BIGINT max) — sufficient
- All arithmetic must use integer math; no division until display time
- Fuel price per liter stored as paise (e.g., ₹105.50 → 10550 paise)
- Stock prices stored as paise — current_price, avg_buy_price
