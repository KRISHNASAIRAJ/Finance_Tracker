-- Migration 0035: Buy List + Grocery List (Personal module)
-- Buy list: items with optional price (paise), reminder date, link, notes, completed tick.
-- Grocery list: same + quantity. Reminders are scheduled locally on the device
-- when the item has a date; no server cron needed.

CREATE TABLE IF NOT EXISTS buy_list_items (
    id          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    price       BIGINT NOT NULL DEFAULT 0,   -- paise (0 = no price)
    item_date   DATE,                        -- optional reminder/buy-by date
    link        TEXT,                        -- optional product link
    notes       TEXT,                        -- optional notes
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buy_list_items_user_id ON buy_list_items(user_id);

CREATE TABLE IF NOT EXISTS grocery_items (
    id          TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    quantity    TEXT NOT NULL DEFAULT '',    -- free-form, e.g. "2 kg", "1 packet"
    price       BIGINT NOT NULL DEFAULT 0,   -- paise (0 = no price)
    item_date   DATE,
    link        TEXT,
    notes       TEXT,
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grocery_items_user_id ON grocery_items(user_id);

ALTER TABLE buy_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns buy_list_items" ON buy_list_items FOR ALL USING (user_id = auth.uid()::text);

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns grocery_items" ON grocery_items FOR ALL USING (user_id = auth.uid()::text);

-- Realtime for web app parity
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['buy_list_items', 'grocery_items']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
