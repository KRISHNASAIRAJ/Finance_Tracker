-- Portfolio Action Plan — per-user editable note shown on Investments dashboard
CREATE TABLE IF NOT EXISTS portfolio_action_plans (
    user_id    TEXT PRIMARY KEY,
    content    TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns their portfolio action plan"
    ON portfolio_action_plans FOR ALL
    USING (user_id = auth.uid()::text);
