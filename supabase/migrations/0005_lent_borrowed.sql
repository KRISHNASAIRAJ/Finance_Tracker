-- Migration 0005: lent_borrowed table (DEVELOPMENT_ORDER 1.3)
-- Replaces simplified receivables with ARCHITECTURE.md spec: direction, status, amount_settled

CREATE TABLE IF NOT EXISTS lent_borrowed (
    id                      TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id                 TEXT NOT NULL,
    direction               TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
    person_name             TEXT NOT NULL,
    amount                  INTEGER NOT NULL,
    date                    TEXT NOT NULL,
    expected_settle_date    TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'settled', 'partial')),
    amount_settled          INTEGER NOT NULL DEFAULT 0,
    notes                   TEXT,
    transaction_id          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lent_borrowed_user_id ON lent_borrowed(user_id);
CREATE INDEX idx_lent_borrowed_direction ON lent_borrowed(direction);
CREATE INDEX idx_lent_borrowed_status ON lent_borrowed(status);

ALTER TABLE lent_borrowed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns lent_borrowed" ON lent_borrowed FOR ALL USING (user_id = auth.uid()::text);
