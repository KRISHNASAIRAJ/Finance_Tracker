-- Migration 0056: Notes v2 — local-model mirror tables.
-- Phase 1 tables only. `attachment` is declared now so Phase 2 needs no schema
-- change; locked-note columns hold ciphertext only and are never indexed.
-- Legacy backfill is intentionally CLIENT-driven (feature flag `notes_v2`):
-- both the mobile migration and this schema use new-table ids, and a server
-- backfill here would create a second copy of every migrated note.

CREATE TABLE IF NOT EXISTS folder (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT,
    sort        INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS note (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id      TEXT NOT NULL,
    title        TEXT NOT NULL DEFAULT '',
    body_md      TEXT NOT NULL DEFAULT '',
    folder_id    TEXT REFERENCES folder(id) ON DELETE SET NULL,
    pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at    TIMESTAMPTZ,
    locked       BOOLEAN NOT NULL DEFAULT FALSE,
    cipher_blob  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER NOT NULL DEFAULT 1,
    device_id    TEXT
);

CREATE TABLE IF NOT EXISTS tag (
    id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id  TEXT NOT NULL,
    name     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tag (
    note_id  TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS note_link (
    note_id     TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('task','transaction','vehicle','bill','goal')),
    entity_id   TEXT NOT NULL,
    missing     BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (note_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS attachment (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    note_id     TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    mime        TEXT NOT NULL,
    size        BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_user_updated ON note(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_user_deleted ON note(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_note_folder ON note(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_user ON folder(user_id);
CREATE INDEX IF NOT EXISTS idx_tag_user ON tag(user_id);
CREATE INDEX IF NOT EXISTS idx_note_link_entity ON note_link(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachment_note ON attachment(note_id);
