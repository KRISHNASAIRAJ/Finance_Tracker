-- Migration 0030: Category spend limits (budgets)
-- One active limit per category (upsert by user_id + category).
-- A limit applies to every month — the UI compares actual monthly spend
-- against the limit and shows progress. Time-bounded items (e.g. EMI for
-- N months) continue to live in fixed_expenses; this table tracks the
-- monthly spending cap per category.

CREATE TABLE category_budgets (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id       TEXT NOT NULL,
    category      TEXT NOT NULL,
    amount_paise  INTEGER NOT NULL CHECK (amount_paise >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, category)
);

CREATE INDEX idx_category_budgets_user_id ON category_budgets(user_id);

ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns category_budgets" ON category_budgets FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User can insert category_budgets" ON category_budgets FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Realtime so the web app reflects mobile edits instantly (and vice-versa)
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_budgets;
