-- Migration 0025: Add odometer (km at service time) to maintenance_logs
-- Used for km-based service reminders (next service = last service km + 3000).

ALTER TABLE maintenance_logs
    ADD COLUMN IF NOT EXISTS odometer INTEGER;
