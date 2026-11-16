-- Migration 0052: reconcile the Realtime publication.
--
-- Tables were added to `supabase_realtime` piecemeal by ~15 different
-- migrations. This single idempotent pass makes the full set of user-facing
-- tables explicit, so a fresh project and an old project end up identical.
-- Secret/material tables (kite_tokens, device_tokens) and internal auth /
-- snapshot tables are deliberately excluded — they have no business being
-- streamed to a browser.

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
        'category_budgets',
        'wallets',
        'user_settings',
        'portfolio_action_plans',
        'holdings',
        'investment_goals',
        'loans',
        'fixed_deposits',
        'vehicles',
        'fuel_fills',
        'maintenance_logs',
        'tasks',
        'goals',
        'notes',
        'recipes',
        'diet_plans',
        'buy_list_items',
        'grocery_items',
        'meal_logs',
        'meal_plans',
        'weight_logs',
        'sleep_logs',
        'habit_logs',
        'career_events',
        'weekly_diary',
        'medications',
        'people',
        'offers',
        'daily_reports',
        'card_documents'
    ]
    LOOP
        -- Only add tables that actually exist and are not already published.
        IF EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
        ) AND NOT EXISTS (
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
