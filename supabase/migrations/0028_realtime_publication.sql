-- Migration 0028: Enable Realtime for all app tables
-- Required for the web app (Phase 10) to reflect mobile changes instantly
-- (and vice-versa) via Supabase Realtime Postgres Changes.

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'transactions',
        'credit_cards',
        'bank_accounts',
        'receivables',
        'fixed_expenses',
        'payzapp_loads',
        'expected_incomes',
        'user_settings',
        'portfolio_action_plans',
        'vehicles',
        'fuel_fills',
        'maintenance_logs',
        'tasks',
        'holdings',
        'investment_goals',
        'portfolio_snapshots',
        'goals',
        'notes',
        'recipes',
        'diet_plans',
        'meal_logs',
        'weight_logs',
        'career_events',
        'weekly_diary'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
