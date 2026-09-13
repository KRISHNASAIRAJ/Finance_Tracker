-- Migration 0036: Fixed Deposits (FDs)
-- Tracks FD balances so the Wealth tab can show net worth
-- (investments + FDs - loans). Amounts are integers (paise).

CREATE TABLE IF NOT EXISTS fixed_deposits (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id       TEXT NOT NULL,
    name          TEXT NOT NULL,
    amount        BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_deposits_user_id ON fixed_deposits(user_id);

ALTER TABLE fixed_deposits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'fixed_deposits' AND policyname = 'User owns fixed_deposits'
    ) THEN
        CREATE POLICY "User owns fixed_deposits" ON fixed_deposits
            FOR ALL USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- Realtime so the web app reflects mobile edits instantly (and vice-versa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'fixed_deposits'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fixed_deposits;
    END IF;
END $$;
