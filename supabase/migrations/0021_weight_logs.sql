-- 0021_weight_logs.sql
-- Weight tracking over time

CREATE TABLE IF NOT EXISTS weight_logs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    date        TEXT NOT NULL,
    weight_kg   REAL NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON weight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON weight_logs(date);

-- RLS
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns weight_logs" ON weight_logs;
CREATE POLICY "User owns weight_logs" ON weight_logs
    FOR ALL
    USING (user_id = auth.uid()::text);
