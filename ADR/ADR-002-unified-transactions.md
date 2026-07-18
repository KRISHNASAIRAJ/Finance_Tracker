# ADR-002: Unified Transactions Table Spine
## Status: Accepted · Date: 2026-07-17

## Context
The app has four modules that all produce "money events": Finance (expenses, card bills, lending), Vehicle Garage (fuel, service), Equity (buys, sells), and Personal Goals. Without a unified model, cross-module queries (e.g., "total outflow this month") would require joining four separate schemas.

## Decision
**Single `transactions` table with a `type` enum and nullable `linked_*_id` foreign keys.**

## Reasoning
- Enables a single SQL query for total monthly outflow across all modules
- Simplifies the "net worth" calculation (one table scan)
- Future cross-module reports (Phase 9) become trivial
- The `source` field (manual/sms_auto/kite_sync) provides provenance for any transaction

## Trade-offs
- The table has many nullable foreign keys — acceptable for a single-user personal app
- Module-specific tables (fuel_fills, vehicle_spends, holdings) still exist for their rich metadata, but always create a corresponding `transactions` row

## Consequences
- Every spending event in every module MUST write to `transactions` first
- The `transactions.id` becomes the canonical ID for cross-module references
- Deletes are soft (status = 'voided') — never hard delete from this table
