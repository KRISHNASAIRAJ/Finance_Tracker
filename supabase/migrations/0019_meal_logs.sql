-- Migration 0019: Meal logger tables

CREATE TABLE meal_logs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    date        TEXT NOT NULL,
    meal_type   TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    items       TEXT NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_logs_user_id ON meal_logs(user_id);
CREATE INDEX idx_meal_logs_date ON meal_logs(date);
CREATE INDEX idx_meal_logs_meal_type ON meal_logs(meal_type);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns meal_logs" ON meal_logs FOR ALL USING (user_id = auth.uid()::text);
