-- Migration 0046: Wallets
-- App wallet balances (Amazon Pay, PayPal, PhonePe, Zepto, Blinkit,
-- BigBasket, ...). Wallet money is liquid — it is tracked separately from
-- bank accounts so the Balance Summary can show both, and it syncs through
-- the central sync queue like every other entity.

CREATE TABLE IF NOT EXISTS wallets (
    id          TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    amount      BIGINT NOT NULL DEFAULT 0,          -- in paise
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- Row-Level Security: a user only ever sees their own wallets.
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns wallets" ON wallets;
CREATE POLICY "User owns wallets" ON wallets FOR ALL USING (user_id = auth.uid()::text);

-- Realtime so the web app mirrors mobile changes instantly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'wallets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
    END IF;
END $$;
