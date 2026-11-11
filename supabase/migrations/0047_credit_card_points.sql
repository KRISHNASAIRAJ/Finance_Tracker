-- Migration 0047: credit card reward points
-- Reward points collected on each card. The value of the points depends on
-- the card's reward program (see mobile/src/modules/finance/cardRewards.ts):
-- IDFC style cards redeem 4 points = ₹1, cashback cards are 1 point = ₹1.

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;
