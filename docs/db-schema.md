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
| `tnc_documents` | Finance/AI | Uploaded card T&C PDFs metadata |
| `tnc_embeddings` | Finance/AI | pgvector embeddings for RAG |
| `vehicles` | Garage | Vehicle registry |
| `fuel_fills` | Garage | Fuel fill-up logs with mileage |
| `vehicle_spends` | Garage | Service, repair, insurance logs |
| `tasks` | Tasks | Task records with recurrence |
| `task_reminders` | Tasks | Reminder timestamps per task |
| `holdings` | Equity | Stock/MF holding positions |
| `portfolio_snapshots` | Equity | Daily portfolio value history |
| `investment_goals` | Equity | Investment goal targets |
| `goals_2026` | Personal | Life goals for 2026 |
| `notes` | Personal | Freeform personal notes |
| `recipes` | Personal | Recipe book |
| `diet_plan_entries` | Personal | Weekly meal plan |

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

task_reminders
  └─→ tasks (task_id) [CASCADE DELETE]

tasks
  └─→ tasks (parent_task_id) [self-referential]

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
YYYYMMDD_HHMMSS_<description>.py

Examples:
20260717_090000_create_shared_transactions.py
20260717_090100_create_finance_tables.py
20260717_090200_create_vehicle_tables.py
20260717_090300_create_task_tables.py
20260717_090400_create_equity_tables.py
20260717_090500_create_personal_notes_tables.py
20260717_090700_create_tnc_embeddings_pgvector.py
```

Create using: `alembic revision --autogenerate -m "create_shared_transactions"`
