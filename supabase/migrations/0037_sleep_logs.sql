-- 0037_sleep_logs.sql
-- Sleep tracking: manual + usage-stats auto-detected logs

CREATE TABLE IF NOT EXISTS sleep_logs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id         TEXT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,           -- bedtime (UTC)
    end_time        TIMESTAMPTZ NOT NULL,           -- wake time (UTC)
    quality         INT CHECK (quality BETWEEN 1 AND 5),
    mood            TEXT,                           -- morning mood label
    interruptions   INT NOT NULL DEFAULT 0,         -- night wake-ups
    notes           TEXT,
    source          TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user ON sleep_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_start ON sleep_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_start ON sleep_logs(user_id, start_time);

-- RLS
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns sleep_logs" ON sleep_logs;
CREATE POLICY "User owns sleep_logs" ON sleep_logs
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert sleep_logs" ON sleep_logs;
CREATE POLICY "User can insert sleep_logs" ON sleep_logs
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

-- Realtime (web mirror)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'sleep_logs'
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', 'sleep_logs');
    END IF;
END $$;
