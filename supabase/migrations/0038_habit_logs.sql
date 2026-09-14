-- 0038_habit_logs.sql
-- Habit tracker: one row per user per day; habits array holds ticked habit keys.

CREATE TABLE IF NOT EXISTS habit_logs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    log_date    DATE NOT NULL,                      -- IST calendar day (YYYY-MM-DD)
    habits      TEXT NOT NULL DEFAULT '[]',         -- JSON array of habit keys done that day
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, log_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);

-- RLS
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns habit_logs" ON habit_logs;
CREATE POLICY "User owns habit_logs" ON habit_logs
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert habit_logs" ON habit_logs;
CREATE POLICY "User can insert habit_logs" ON habit_logs
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
          AND tablename = 'habit_logs'
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', 'habit_logs');
    END IF;
END $$;
