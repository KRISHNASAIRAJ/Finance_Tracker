-- Migration 0023: Explicit INSERT WITH CHECK RLS policies
-- Ensures INSERTs are allowed for all sync-queue-managed tables.
-- The existing FOR ALL USING (...) policies should cover this, but explicit
-- FOR INSERT WITH CHECK ensures writes work even with permissive/restrictive mixtures.
-- Note: expected_incomes, user_settings, and card_documents already have
-- WITH CHECK policies (UUID user_id) — skipped here.

CREATE POLICY "User can insert transactions" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert credit_cards" ON credit_cards FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert bank_accounts" ON bank_accounts FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert receivables" ON receivables FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert fixed_expenses" ON fixed_expenses FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert payzapp_loads" ON payzapp_loads FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert tasks" ON tasks FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert notes" ON notes FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert goals" ON goals FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert recipes" ON recipes FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert diet_plans" ON diet_plans FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert fuel_fills" ON fuel_fills FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert maintenance_logs" ON maintenance_logs FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert holdings" ON holdings FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert vehicles" ON vehicles FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert meal_logs" ON meal_logs FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert weight_logs" ON weight_logs FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "User can insert career_events" ON career_events FOR INSERT WITH CHECK (user_id = auth.uid()::text);
