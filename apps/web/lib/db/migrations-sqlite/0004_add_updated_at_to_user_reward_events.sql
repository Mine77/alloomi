-- Add updated_at column to user_reward_events table
-- This column was defined in the schema but missing from the initial migration

-- Add the column if it doesn't exist (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
-- We'll use a try-catch approach by checking if the column exists first
-- SQLite doesn't have a straightforward way to check column existence, so we'll attempt the ALTER
-- If the column already exists, this will fail gracefully in the migration handler

ALTER TABLE user_reward_events ADD COLUMN updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL;
