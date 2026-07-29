-- Migration 0007: Vehicles table for multi-vehicle garage support

CREATE TABLE vehicles (
    id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    make            TEXT,
    model           TEXT,
    year            INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns vehicles" ON vehicles FOR ALL USING (user_id = auth.uid()::text);
