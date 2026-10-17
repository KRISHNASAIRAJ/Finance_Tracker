-- 0043_offers.sql
-- Offers module: track bank/card/app discount offers with coupon codes,
-- minimum spend and expiry reminders (3 & 2 days before at 6 PM IST).

CREATE TABLE IF NOT EXISTS offers (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    merchant        TEXT,                            -- merchant / app / bank
    category        TEXT,                            -- e.g. Shopping, Travel, Food
    coupon_code     TEXT,                            -- optional redemption code
    discount_value  TEXT,                            -- free text, e.g. "20% off", "₹200 off"
    min_spend_paise BIGINT,                          -- optional minimum spend (paise)
    expires_on      DATE NOT NULL,                   -- offer expiry date (IST day)
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offers_user ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_user_expires ON offers(user_id, expires_on);

-- RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns offers" ON offers;
CREATE POLICY "User owns offers" ON offers
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert offers" ON offers;
CREATE POLICY "User can insert offers" ON offers
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
          AND tablename = 'offers'
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', 'offers');
    END IF;
END $$;
