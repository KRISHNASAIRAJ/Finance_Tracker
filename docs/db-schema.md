# DB Schema Reference
## Personal Tracker App · Krishna's Tracker

> Quick-reference for all tables and their columns.  
> Full schemas with SQL DDL are in `ARCHITECTURE.md` Section 3.  
> For migrations, see `backend/migrations/`.

---

## Tables at a Glance

| Table | Module | Description |
|---|---|---|
| `transactions` | Shared | Unified money event spine — ALL modules write here |
| `credit_cards` | Finance | Credit card accounts |
| `bank_accounts` | Finance | Bank savings/current accounts |
| `lent_borrowed` | Finance | Person-to-person lending records |
| `fixed_expenses` | Finance | Recurring bills and subscriptions |
| `expected_incomes` | Finance | Expected income entries per user |
| `user_settings` | Finance | Per-user settings (monthly budget) |
| `category_budgets` | Finance | Per-category monthly spend limits (upsert by user_id + category) |
| `payzapp_loads` | Finance | Payzapp wallet load tracking |
| `kite_tokens` | Equity | Kite Connect OAuth access tokens |
| `tnc_documents` | Finance/AI | Uploaded card T&C PDFs metadata |
| `tnc_embeddings` | Finance/AI | pgvector embeddings for RAG |
| `vehicles` | Garage | Vehicle registry |
| `fuel_fills` | Garage | Fuel fill-up logs with mileage |
| `vehicle_spends` | Garage | Service, repair, insurance logs |
| `tasks` | Tasks | Task records with recurrence |
| `portfolio_snapshots` | Equity | Daily portfolio value history |
| `investment_goals` | Equity | Investment goal targets |
| `goals_2026` | Personal | Life goals for 2026 |
| `notes` | Personal | Freeform personal notes |
| `recipes` | Personal | Recipe book |
| `diet_plan_entries` | Personal | Weekly meal plan |
| `device_tokens` | Shared | Expo push notification tokens |

---

## Foreign Key Map

```
transactions
  └─→ bank_accounts (linked_account_id)
  └─→ credit_cards (linked_card_id)
  └─→ vehicles (linked_vehicle_id)
  └─→ holdings (linked_holding_id)

credit_cards
  └─→ tnc_documents (tnc_document_id)

tnc_documents
  └─→ credit_cards (card_id) [CASCADE DELETE]

tnc_embeddings
  └─→ tnc_documents (document_id) [CASCADE DELETE]

fuel_fills
  └─→ vehicles (vehicle_id)
  └─→ transactions (transaction_id)

vehicle_spends
  └─→ vehicles (vehicle_id)
  └─→ transactions (transaction_id)

lent_borrowed
  └─→ transactions (transaction_id)

diet_plan_entries
  └─→ recipes (recipe_id)
```

---

## Indexes Summary

| Table | Index | Purpose |
|---|---|---|
| `transactions` | `(type)` | Filter by transaction type |
| `transactions` | `(date DESC)` | Date-range queries |
| `transactions` | `(linked_account_id)` | Per-account transaction list |
| `transactions` | `(linked_card_id)` | Per-card transaction list |
| `tnc_embeddings` | `(document_id)` | Chunk lookup by document |
| `tnc_embeddings` | `ivfflat (embedding)` | Vector similarity search |
| `fuel_fills` | `(vehicle_id, date DESC)` | Per-vehicle fuel history |
| `tasks` | `(status, due_date)` | Task list filtering |
| `portfolio_snapshots` | `(date)` | Historical chart queries |
| `holdings` | `(source)` | Filter by manual vs kite_sync |

---

## Migration Naming Convention

```
NNNN_description.sql

Migrations are numbered sequentially in supabase/migrations/:
0001_init.sql              — All base tables
0002_rls.sql               — Row-Level Security policies
0003_storage.sql           — Storage buckets
0004_finance_polish.sql    — Finance polish
0005_lent_borrowed.sql     — Lent/borrowed table
0006_fix_users_rls.sql     — User RLS fixes
0007_vehicles.sql          — Vehicle garage tables
0008_tasks_recurrence.sql  — Task recurrence fields
0009_equity.sql            — Equity holdings + Kite tokens
0010_mf_fields.sql         — Mutual fund fields
0011_pg_cron_portfolio_snapshot.sql — Cron job for snapshots
0012_allocation_category.sql — Allocation categories
0013_device_tokens.sql     — Push token registration
0014_credit_card_bill_tracking.sql — Card bill tracking
0015_card_documents.sql    — Card T&C documents
0016_user_settings.sql     — Expected incomes + user settings
0017_tasks_completed_at.sql — Task completion timestamps
```

Push to remote: `supabase db push --linked`
