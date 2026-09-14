-- 0042_repair_meal_plans.sql
-- Repair for 0041: CI applied the migration but errored at the CREATE POLICY
-- statements (syntax — missing ON), so the migration was marked applied while
-- the RLS policies and realtime publication were never created. Everything
-- here is idempotent (DROP ... IF EXISTS + DO-block guards).

-- RLS policies (the statements that failed in 0041)
DROP POLICY IF EXISTS "User owns meal_plans" ON meal_plans;
CREATE POLICY "User owns meal_plans" ON meal_plans
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert meal_plans" ON meal_plans;
CREATE POLICY "User can insert meal_plans" ON meal_plans
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

-- Realtime (never reached in 0041)
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

-- Sanity: 0040 columns must exist (0040 applied cleanly before 0041 failed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'user_settings'
                     AND column_name = 'habit_defs') THEN
        ALTER TABLE user_settings ADD COLUMN habit_defs TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'user_settings'
                     AND column_name = 'career_goals_json') THEN
        ALTER TABLE user_settings ADD COLUMN career_goals_json TEXT;
    END IF;
END $$;
