-- Migration 0012: Add allocation_category to holdings
-- GOLDBEES → Gold, BIRET/EMBASSY → Realty, equity → Equity, mf → Mutual Funds, etf → ETF

ALTER TABLE holdings ADD COLUMN IF NOT EXISTS allocation_category TEXT;

-- Set existing holdings based on symbol
UPDATE holdings SET allocation_category = 'Gold' WHERE symbol IN ('GOLDBEES', 'GOLDBEES');
UPDATE holdings SET allocation_category = 'Realty' WHERE symbol ILIKE '%EMBASSY%' OR symbol ILIKE '%BIRET%' OR symbol ILIKE '%REIT%';
UPDATE holdings SET allocation_category = 'Mutual Funds' WHERE type = 'mf';
UPDATE holdings SET allocation_category = 'ETF' WHERE type = 'etf' AND allocation_category IS NULL;
UPDATE holdings SET allocation_category = 'Equity' WHERE type = 'equity' AND allocation_category IS NULL;
UPDATE holdings SET allocation_category = 'Other' WHERE allocation_category IS NULL;
