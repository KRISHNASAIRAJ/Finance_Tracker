-- Migration 0053: issues found on a vehicle that must be reported at the next
-- service. Deliberately NOT a financial event, so there is no `transactions`
-- row and no `linked_*` column — it is a free-form to-do list per vehicle.

CREATE TABLE IF NOT EXISTS vehicle_service_issues (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id       TEXT NOT NULL,
    vehicle       TEXT NOT NULL,
    title         TEXT NOT NULL,
    notes         TEXT NOT NULL DEFAULT '',
    severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed')),
    odometer_km   INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fixed_at      TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_service_issues_user
    ON vehicle_service_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_issues_user_vehicle_status
    ON vehicle_service_issues(user_id, vehicle, status);

ALTER TABLE vehicle_service_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns vehicle_service_issues" ON vehicle_service_issues;
CREATE POLICY "User owns vehicle_service_issues" ON vehicle_service_issues
    FOR ALL
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "User can insert vehicle_service_issues" ON vehicle_service_issues;
CREATE POLICY "User can insert vehicle_service_issues" ON vehicle_service_issues
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'vehicle_service_issues'
    ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                       'vehicle_service_issues');
    END IF;
END $$;
