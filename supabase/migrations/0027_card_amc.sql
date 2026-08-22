-- Migration 0027: Credit card annual charges (AMC) tracking
-- Adds annual_charge, annual_charge_date, and is_ltf to credit_cards
-- for AMC reminders (30 days before due date).

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS annual_charge INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_charge_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_ltf BOOLEAN DEFAULT FALSE;
