-- Migration 0009: Equity/MF tracker tables
-- Phase 4: holdings, portfolio_snapshots, investment_goals, kite_tokens

-- 1. Holdings (stock/MF positions)
CREATE TABLE holdings (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    fund_name       TEXT,
    type            TEXT NOT NULL CHECK (type IN ('equity', 'mf', 'etf', 'other')),
    quantity        NUMERIC(15,4) NOT NULL,
    avg_buy_price   BIGINT NOT NULL,
    current_price   BIGINT,
    current_value   BIGINT,
    source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'kite_sync')),
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_holdings_user_id ON holdings(user_id);
CREATE UNIQUE INDEX idx_holdings_user_symbol ON holdings(user_id, symbol);

-- 2. Portfolio snapshots (daily value history)
CREATE TABLE portfolio_snapshots (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    date            DATE NOT NULL,
    total_value     BIGINT NOT NULL,
    day_change      BIGINT,
    day_change_pct  NUMERIC(6,4),
    allocation_json JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE UNIQUE INDEX idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, date);

-- 3. Investment goals (target-based)
CREATE TABLE investment_goals (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    goal_name       TEXT NOT NULL,
    target_amount   BIGINT NOT NULL,
    target_date     DATE,
    current_progress BIGINT NOT NULL DEFAULT 0,
    linked_holding_ids TEXT[],
    priority        TEXT DEFAULT 'medium',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_goals_user_id ON investment_goals(user_id);

-- 4. Kite tokens (OAuth access tokens for Zerodha)
CREATE TABLE kite_tokens (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL UNIQUE,
    access_token    TEXT NOT NULL,
    public_token    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kite_tokens_user_id ON kite_tokens(user_id);

-- RLS
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns holdings" ON holdings FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns portfolio_snapshots" ON portfolio_snapshots FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns investment_goals" ON investment_goals FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns kite_tokens" ON kite_tokens FOR ALL USING (user_id = auth.uid()::text);
