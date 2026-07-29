-- Migration 0010: Mutual fund-specific columns for holdings table
-- Phase 4: Adds folio, AMC, scheme, ISIN, and SIP fields for MF tracking

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS folio_number TEXT,
  ADD COLUMN IF NOT EXISTS amc TEXT,
  ADD COLUMN IF NOT EXISTS scheme_code TEXT,
  ADD COLUMN IF NOT EXISTS isin TEXT,
  ADD COLUMN IF NOT EXISTS sip_amount BIGINT,
  ADD COLUMN IF NOT EXISTS sip_day INTEGER CHECK (sip_day IS NULL OR (sip_day >= 1 AND sip_day <= 28));
