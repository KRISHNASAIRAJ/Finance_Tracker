-- 0041_meal_planner.sql
-- Meal planner: what to cook for a specific date (future or past), with
-- recipe link + notes. One row per user per date per slot.

CREATE TABLE IF NOT EXISTS meal_plans (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    plan_date   DATE NOT NULL,                      -- IST calendar day (YYYY-MM-DD)
    slot        TEXT NOT NULL,                      -- 'breakfast' | 'lunch' | 'snack' | 'dinner'
    recipe_id   TEXT,                               -- optional link to recipes.id
    title       TEXT NOT NULL,                      -- meal title (from recipe or custom)
    notes       TEXT,
    done        BOOLEAN NOT NULL DEFAULT false,     -- cooked / eaten
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, plan_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, plan_date);

-- RLS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns meal_plans" ON meal_plans;
CREATE POLICY "User owns meal_plans"
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert meal_plans" ON meal_plans;
CREATE POLICY "User can insert meal_plans"
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
          AND tablename = 'meal_plans'
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', 'meal_plans');
    END IF;
END $$;
