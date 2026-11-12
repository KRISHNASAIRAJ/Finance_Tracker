-- The "keep in touch" list: the people you want to stay in touch with and
-- how often (weekly / monthly / every 45 days / every N days).

CREATE TABLE IF NOT EXISTS people (
    id                 TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    user_id            TEXT NOT NULL,
    name               TEXT NOT NULL,
    phone              TEXT,
    email              TEXT,
    notes              TEXT,
    -- weekly | monthly | days_45 | custom
    cadence            TEXT NOT NULL DEFAULT 'monthly',
    -- the length of a custom interval in days
    interval_days      INTEGER,
    -- when the person was last contacted (ISO timestamp)
    last_contacted_at  TEXT,
    -- when the person is next due (ISO timestamp)
    next_due_at        TEXT NOT NULL,
    sort_order         INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_next_due ON people(user_id, next_due_at);

-- Row level security — a person belongs to exactly one user.
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns people" ON people;
CREATE POLICY "User owns people" ON people FOR ALL USING (user_id = auth.uid()::text);

-- Realtime: the mobile and the web mirror each other instantly.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE people;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
