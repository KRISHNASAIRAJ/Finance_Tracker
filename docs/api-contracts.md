# API Contracts
## Personal Tracker App · Krishna's Tracker

> All API endpoints follow REST conventions. Base URL: `/api/v1`  
> Authentication: All endpoints require `Authorization: Bearer <jwt_token>` unless marked `[PUBLIC]`  
> Response format: `{ success, data, meta, error }`

---

## Standard Response Envelope

```typescript
// Success
{
  "success": true,
  "data": T,
  "meta": { "total"?: number, "page"?: number, "per_page"?: number },
  "error": null
}

// Error
{
  "success": false,
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Pydantic validation failed |
| `NOT_FOUND` | 404 | Resource does not exist |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient permissions |
| `RATE_LIMITED` | 429 | AI call rate limit exceeded |
| `AI_UNAVAILABLE` | 503 | Claude API timeout or error |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Module 1: Finance — Credit Cards

```
GET    /api/v1/credit-cards              → List all credit cards
POST   /api/v1/credit-cards              → Create new credit card
GET    /api/v1/credit-cards/{id}         → Get card details
PATCH  /api/v1/credit-cards/{id}         → Update card
DELETE /api/v1/credit-cards/{id}         → Soft delete card

POST   /api/v1/credit-cards/{id}/tnc    → Upload T&C document (multipart/form-data)
GET    /api/v1/credit-cards/{id}/tnc    → Get T&C document metadata
POST   /api/v1/credit-cards/{id}/tnc/chat → Ask T&C question (AI Use Case A)
```

**POST /api/v1/credit-cards — Request**
```json
{
  "name": "HDFC Regalia",
  "bank": "HDFC",
  "card_limit": 50000000,      // paise (₹5,00,000)
  "billing_cycle_date": 15,    // 15th of each month
  "due_date_offset": 20        // due 20 days after cycle close
}
```

**POST /api/v1/credit-cards/{id}/tnc/chat — Request**
```json
{
  "question": "What is the annual fee waiver condition?"
}
```

**POST /api/v1/credit-cards/{id}/tnc/chat — Response**
```json
{
  "success": true,
  "data": {
    "answer": "The annual fee is waived if you spend ₹2,00,000 in the card year...",
    "disclaimer": "Based on the document you uploaded. Verify current terms directly with your bank.",
    "sources_used": 2
  }
}
```

---

## Module 1: Finance — Bank Accounts

```
GET    /api/v1/bank-accounts             → List all accounts
POST   /api/v1/bank-accounts             → Create account
PATCH  /api/v1/bank-accounts/{id}        → Update account (balance, nickname)
DELETE /api/v1/bank-accounts/{id}        → Soft delete
```

---

## Module 1: Finance — Transactions

```
GET    /api/v1/transactions              → List transactions (paginated)
POST   /api/v1/transactions              → Create transaction
PATCH  /api/v1/transactions/{id}         → Update transaction
DELETE /api/v1/transactions/{id}         → Soft delete (status = voided)

GET    /api/v1/transactions/summary      → Aggregated summary for dashboard
```

**GET /api/v1/transactions — Query Params**
```
?type=expense,fuel_purchase          // comma-separated types
?date_from=2026-07-01
?date_to=2026-07-31
?linked_card_id=<uuid>
?source=manual,sms_auto
?page=1&per_page=20
```

**GET /api/v1/transactions/summary — Response**
```json
{
  "success": true,
  "data": {
    "net_worth_paise": 250000000,
    "monthly_spend_paise": 4500000,
    "bank_total_paise": 300000000,
    "card_outstanding_paise": 1200000,
    "lent_pending_paise": 500000,
    "borrowed_pending_paise": 0
  }
}
```

---

## Module 1: Finance — Lent/Borrowed

```
GET    /api/v1/lent-borrowed             → List all records
POST   /api/v1/lent-borrowed             → Create record
PATCH  /api/v1/lent-borrowed/{id}        → Update (status, amount_settled)
```

---

## Module 1: Finance — Fixed Expenses

```
GET    /api/v1/fixed-expenses            → List all fixed expenses
POST   /api/v1/fixed-expenses            → Create
PATCH  /api/v1/fixed-expenses/{id}       → Update
DELETE /api/v1/fixed-expenses/{id}       → Deactivate (is_active = false)
```

---

## Module 2: Vehicle Garage

```
GET    /api/v1/vehicles                  → List vehicles
POST   /api/v1/vehicles                  → Create vehicle
PATCH  /api/v1/vehicles/{id}             → Update vehicle
DELETE /api/v1/vehicles/{id}             → Soft delete

GET    /api/v1/vehicles/{id}/fuel-fills  → List fuel fills for a vehicle
POST   /api/v1/vehicles/{id}/fuel-fills  → Add fuel fill (auto-computes mileage)
GET    /api/v1/vehicles/{id}/spends      → List vehicle spends
POST   /api/v1/vehicles/{id}/spends      → Add vehicle spend

GET    /api/v1/vehicles/{id}/dashboard   → Vehicle dashboard data (mileage trend, cost breakdown)
```

---

## Module 3: Task Manager

```
GET    /api/v1/tasks                     → List tasks (filterable)
POST   /api/v1/tasks                     → Create task
GET    /api/v1/tasks/{id}                → Get task with subtasks
PATCH  /api/v1/tasks/{id}                → Update task
DELETE /api/v1/tasks/{id}                → Soft delete (status = cancelled)

POST   /api/v1/tasks/{id}/complete       → Mark complete (triggers recurrence if applicable)

GET    /api/v1/task-reminders            → List upcoming reminders
```

---

## Module 4: Equity / MF Tracker

```
GET    /api/v1/holdings                  → List all holdings
POST   /api/v1/holdings                  → Add manual holding
PATCH  /api/v1/holdings/{id}             → Update holding (price, quantity)
DELETE /api/v1/holdings/{id}             → Remove holding

POST   /api/v1/holdings/sync-kite        → Trigger Kite sync (Phase 5+)

GET    /api/v1/portfolio/dashboard       → Portfolio summary (total, day change, allocation)
GET    /api/v1/portfolio/history         → Historical snapshots (for charts)

GET    /api/v1/investment-goals          → List goals
POST   /api/v1/investment-goals          → Create goal
PATCH  /api/v1/investment-goals/{id}     → Update goal
DELETE /api/v1/investment-goals/{id}     → Delete goal

POST   /api/v1/portfolio/ai-recommend    → Generate AI recommendations (AI Use Case B)
```

**POST /api/v1/portfolio/ai-recommend — Response**
```json
{
  "success": true,
  "data": {
    "recommendations": "Your portfolio is 68% concentrated in large-cap equity...",
    "disclaimer": "For informational purposes only. This is not investment advice.",
    "generated_at": "2026-07-17T13:00:00Z",
    "cached": false
  }
}
```

---

## Module 5: Personal Notes & Goals

```
GET    /api/v1/goals-2026                → List 2026 life goals
POST   /api/v1/goals-2026                → Create goal
PATCH  /api/v1/goals-2026/{id}           → Update (status change, reflection)

GET    /api/v1/notes                     → List notes (search + tags)
POST   /api/v1/notes                     → Create note
PATCH  /api/v1/notes/{id}                → Update note
DELETE /api/v1/notes/{id}                → Delete note

GET    /api/v1/recipes                   → List recipes (filterable)
POST   /api/v1/recipes                   → Create recipe
PATCH  /api/v1/recipes/{id}              → Update recipe
DELETE /api/v1/recipes/{id}              → Delete recipe

GET    /api/v1/diet-plan                 → Get weekly diet plan
PUT    /api/v1/diet-plan/{date}/{slot}   → Set a specific meal slot
DELETE /api/v1/diet-plan/{date}/{slot}   → Clear a meal slot
```

---

## Module 6: Fitness

```
GET    /api/v1/fitness/steps             → Get steps history (7-day default)
POST   /api/v1/fitness/steps/sync        → Push Health Connect data to backend
```

---

## Cross-Cutting

```
GET    /api/v1/dashboard                 → Combined home dashboard data
POST   /api/v1/sms/parse                 → Parse SMS text (AI Use Case C — internal use)
GET    /api/v1/health                    → [PUBLIC] Health check
```
