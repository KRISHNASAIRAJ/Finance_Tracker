-- Migration 0002: Row-Level Security policies
-- Every table is scoped to auth.uid() — single user has single uid

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payzapp_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns users" ON users FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns transactions" ON transactions FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns credit_cards" ON credit_cards FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns bank_accounts" ON bank_accounts FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns receivables" ON receivables FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns fixed_expenses" ON fixed_expenses FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns payzapp_loads" ON payzapp_loads FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns fuel_fills" ON fuel_fills FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns maintenance_logs" ON maintenance_logs FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns tasks" ON tasks FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns notes" ON notes FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns goals" ON goals FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns recipes" ON recipes FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "User owns diet_plans" ON diet_plans FOR ALL USING (user_id = auth.uid()::text);

-- Allow authenticated inserts into users (for signup)
CREATE POLICY "Allow insert users" ON users
  FOR INSERT
  WITH CHECK (true);

-- Service role bypass (admin operations, Edge Functions)
-- When using service_role key, RLS is bypassed automatically
