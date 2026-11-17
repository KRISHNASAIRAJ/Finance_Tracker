-- Migration 0054: remember every wake-up inside a sleep night.
--
-- `interruptions` is only a count. The morning summary needs the exact length
-- (and time) of each awake gap — especially the ones over 15 minutes — so the
-- full list is stored as JSON. Stored as JSONB (not TEXT) so it can be queried
-- later if needed, with an empty array default so existing rows are valid.

ALTER TABLE sleep_logs
    ADD COLUMN IF NOT EXISTS wake_ups JSONB NOT NULL DEFAULT '[]'::jsonb;
