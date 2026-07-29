-- Migration 0004: Finance schema polish (DEVELOPMENT_ORDER 1.1, 1.2)
-- Adds missing columns to align with ARCHITECTURE.md spec

-- 1.1: Add linked_account_id to transactions (for FKs to bank_accounts)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_account_id TEXT;

-- 1.2: Add bank, card_limit, current_outstanding to credit_cards
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS bank TEXT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS card_limit INTEGER DEFAULT 0;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS current_outstanding INTEGER DEFAULT 0;

-- Populate current_outstanding from existing balance (one-time migration)
UPDATE credit_cards SET current_outstanding = balance WHERE current_outstanding = 0;

-- Populate bank from name (extract first word — best-effort heuristic)
UPDATE credit_cards SET bank = SPLIT_PART(name, ' ', 1) WHERE bank IS NULL;
