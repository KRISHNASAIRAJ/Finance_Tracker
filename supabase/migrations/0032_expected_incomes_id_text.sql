-- Migration 0032: expected_incomes.id → TEXT
--
-- The app generates string ids like "expinc_1786160272770_vl92te", but the
-- column was UUID, so every create/update/delete for expected incomes failed
-- with "invalid input syntax for type uuid" and permanently wedged the sync
-- queue (shown as a stuck 429 error in the app).
-- Align with every other table in the app (all use TEXT ids).

ALTER TABLE expected_incomes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE expected_incomes ALTER COLUMN id TYPE TEXT USING id::text;
