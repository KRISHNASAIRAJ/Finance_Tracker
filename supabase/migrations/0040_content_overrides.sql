-- 0040_content_overrides.sql
-- Editable habits + career goals (long-press edit on mobile/web).
-- Overrides live in user_settings as JSON content columns so they sync with
-- the existing settings row (one row per user) — no new tables needed.

-- Editable habit definitions (key/label/emoji); empty = use canonical set
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS habit_defs TEXT;

-- Editable career goal years (year/title/emoji/items JSON array)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS career_goals_json TEXT;
