-- Migration 0018: Career events table
-- Stores career ups/downs with type (up/down/balance)

CREATE TABLE career_events (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    date        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('up', 'down', 'balance')),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_career_events_user_id ON career_events(user_id);
CREATE INDEX idx_career_events_date ON career_events(date);

ALTER TABLE career_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns career_events" ON career_events FOR ALL USING (user_id = auth.uid()::text);
