-- Migration 0033: Ensure category_budgets table exists
-- 0030 was recorded as applied but the table wasn't actually created (likely
-- a transient error in the original run). This re-creates it safely so the
-- sync queue can flush stuck category budget upserts.

CREATE TABLE IF NOT EXISTS category_budgets (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id       TEXT NOT NULL,
    category      TEXT NOT NULL,
    amount_paise  INTEGER NOT NULL CHECK (amount_paise >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_category_budgets_user_id ON category_budgets(user_id);

ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'category_budgets' AND policyname = 'User owns category_budgets') THEN
    CREATE POLICY "User owns category_budgets" ON category_budgets FOR ALL USING (user_id = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'category_budgets' AND policyname = 'User can insert category_budgets') THEN
    CREATE POLICY "User can insert category_budgets" ON category_budgets FOR INSERT WITH CHECK (user_id = auth.uid()::text);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'category_budgets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.category_budgets;
  END IF;
END
$$;