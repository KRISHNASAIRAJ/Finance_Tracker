-- Stores the previous close price for each holding so we can compute
-- live intraday P&L (currentPrice - prevClose) without a separate snapshot.
-- Populated by refresh-portfolio-prices edge function.

ALTER TABLE holdings ADD COLUMN IF NOT EXISTS prev_close BIGINT;