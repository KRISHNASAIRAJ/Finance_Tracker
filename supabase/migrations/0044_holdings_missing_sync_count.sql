-- 0044_holdings_missing_sync_count.sql
-- Two-strike reconciliation for Kite sync: a kite_sync holding that is absent
-- from the Kite portfolio response is only deleted after it has been missing
-- for TWO consecutive successful syncs. Protects against transient Kite API
-- glitches (partial responses, endpoint hiccups) wiping real holdings.

ALTER TABLE holdings
    ADD COLUMN IF NOT EXISTS missing_sync_count INT NOT NULL DEFAULT 0;
