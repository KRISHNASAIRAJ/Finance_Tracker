-- Migration 0048: medication (pill) reminders
-- Each medication has a name, an optional dosage and a list of daily dose
-- times ("08:00", "20:00"). The app schedules a local notification per dose
-- with Skip / Remind-in-30-min actions.

CREATE TABLE IF NOT EXISTS medications (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    dosage      TEXT,
    times       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["08:00","20:00"]
    notes       TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns medications" ON medications;
CREATE POLICY "User owns medications" ON medications FOR ALL USING (user_id = auth.uid()::text);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'medications'
       )
    THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE medications;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'medications: skipped supabase_realtime publication (%)', SQLERRM;
        END;
    END IF;
END $$;
