-- 0039_notes_folders_pin.sql
-- Apple-Notes-style notes: folders + pinned notes + soft delete (recently deleted).

ALTER TABLE notes
    ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'Notes',
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(user_id, folder);
