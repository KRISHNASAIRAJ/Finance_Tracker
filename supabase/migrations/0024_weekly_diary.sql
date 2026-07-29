-- Migration 0024: Weekly diary table
-- Stores weekly diary entries for each week of the year

CREATE TABLE weekly_diary (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    week_year   INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_year, week_number)
);

CREATE INDEX idx_weekly_diary_user_id ON weekly_diary(user_id);
CREATE INDEX idx_weekly_diary_week ON weekly_diary(week_year, week_number);

ALTER TABLE weekly_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns weekly_diary" ON weekly_diary FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User can insert weekly_diary" ON weekly_diary FOR INSERT WITH CHECK (user_id = auth.uid()::text);
