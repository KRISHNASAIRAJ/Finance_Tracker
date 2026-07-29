-- Migration 0014: Credit card bill payment tracking
-- Adds bill_amount and paid_amount to credit_cards for partial/full bill payment flow

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS bill_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0;
