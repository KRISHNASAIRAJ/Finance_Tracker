-- Migration 0013: Device tokens for push notifications (FCM/Expo)

CREATE TABLE IF NOT EXISTS device_tokens (
    id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    user_id         TEXT NOT NULL,
    token           TEXT NOT NULL,
    platform        TEXT NOT NULL DEFAULT 'android',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_device_tokens_user_token ON device_tokens(user_id, token);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns device_tokens" ON device_tokens FOR ALL USING (user_id = auth.uid()::text);
