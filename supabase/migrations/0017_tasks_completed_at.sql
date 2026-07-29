-- Migration 0017: Add completed_at column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
