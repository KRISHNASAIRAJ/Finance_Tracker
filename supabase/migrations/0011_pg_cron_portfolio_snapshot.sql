-- Migration 0011: Phase 4 — pg_cron job for daily portfolio snapshot
-- Runs at 8:30 PM IST = 15:00 UTC daily

DO $$
BEGIN
  PERFORM cron.unschedule('portfolio-snapshot');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'portfolio-snapshot',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rkmouoglorsnijmemmcd.supabase.co/functions/v1/portfolio-snapshot',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
