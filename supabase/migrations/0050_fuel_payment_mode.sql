-- Fuel fills: how they were paid + the stable link to the finance transaction.
--
-- The payment mode drives the linked fuel_purchase transaction and, for
-- "hp_pay", the HP Pay wallet balance. `linked_fuel_fill_id` is the stable
-- link between a fuel fill and its transaction — the old date+amount match
-- broke as soon as one of them was edited.

ALTER TABLE fuel_fills
    ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash';

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS linked_fuel_fill_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_linked_fuel_fill ON transactions(linked_fuel_fill_id);

-- The wallets: HP Pay joins the standard providers (Amazon Pay, PhonePe,
-- Zepto, Blinkit, BigBasket). The row is created by the app on first open —
-- this migration only makes sure the id is free.
