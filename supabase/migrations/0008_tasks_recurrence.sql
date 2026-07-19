-- Migration 0008: Add recurrence column to tasks, add linked_account_id to transactions

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none';
