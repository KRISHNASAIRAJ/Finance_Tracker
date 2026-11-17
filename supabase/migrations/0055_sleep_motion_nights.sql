-- Migration 0055: cloud backup of the raw per-minute sleep motion timeline.
--
-- `sleep_logs` stores the RESULT (bedtime, wake, wake-ups). This table stores
-- the INPUT (one compact bucket per minute) so the scoring algorithm can be
-- validated and tuned against real nights without pulling data off the device.
-- One row per night — a JSONB array is far cheaper than ~720 bucket rows.

CREATE TABLE IF NOT EXISTS sleep_motion_nights (
    id            TEXT PRIMARY KEY,                 -- 'mn_<yyyy-mm-dd>' (bedtime key)
    user_id       TEXT NOT NULL,
    buckets       JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_minute  BIGINT NOT NULL,
    end_minute    BIGINT NOT NULL,
    bucket_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sleep_motion_nights_user
    ON sleep_motion_nights(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_motion_nights_user_start
    ON sleep_motion_nights(user_id, start_minute);

ALTER TABLE sleep_motion_nights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns sleep_motion_nights" ON sleep_motion_nights;
CREATE POLICY "User owns sleep_motion_nights" ON sleep_motion_nights
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert sleep_motion_nights" ON sleep_motion_nights;
CREATE POLICY "User can insert sleep_motion_nights" ON sleep_motion_nights
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'sleep_motion_nights'
    ) THEN
        EXECUTE format(
            'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
            'sleep_motion_nights'
        );
    END IF;
END $$;
