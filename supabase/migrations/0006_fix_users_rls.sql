-- Migration 0006: Fix users table RLS policy
-- Column is supabase_id, not user_id

DROP POLICY IF EXISTS "User owns users" ON users;
DROP POLICY IF EXISTS "Allow insert users" ON users;

CREATE POLICY "User owns users" ON users FOR ALL USING (supabase_id = auth.uid()::text);
CREATE POLICY "Allow insert users" ON users
  FOR INSERT
  WITH CHECK (true);

ALTER TABLE lent_borrowed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns lent_borrowed" ON lent_borrowed FOR ALL USING (user_id = auth.uid()::text);
