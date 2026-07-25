ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'bank';
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
