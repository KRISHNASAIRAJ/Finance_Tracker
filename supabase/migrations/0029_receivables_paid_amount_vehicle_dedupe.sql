-- Migration 0029: Receivables paid_amount + vehicle dedupe
--
-- 1. receivables is missing paid_amount (the app tracks partial payments,
--    the web's mark-paid mutation needs the column).
-- 2. vehicles accumulated duplicate rows (pushMissing used random ids on
--    every pull). Dedupe by name and keep one row per (user_id, name).

ALTER TABLE receivables ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0;
UPDATE receivables SET paid_amount = 0 WHERE paid_amount IS NULL;

-- Dedupe vehicles: keep the OLDEST row per (user_id, name), delete the rest
DELETE FROM vehicles a
USING vehicles b
WHERE a.id <> b.id
  AND a.user_id = b.user_id
  AND a.name = b.name
  AND a.created_at > b.created_at;

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_user_name ON vehicles(user_id, name);
