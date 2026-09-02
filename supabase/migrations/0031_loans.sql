-- Migration 0031: Loans
-- Tracks outstanding loans so the Wealth tab can show net worth
-- (equity investments - total loans). Amounts are integers (paise).

CREATE TABLE loans (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id       TEXT NOT NULL,
    name          TEXT NOT NULL,
    amount        BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loans_user_id ON loans(user_id);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns loans" ON loans FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User can insert loans" ON loans FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Realtime so the web app reflects mobile edits instantly (and vice-versa)
ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
