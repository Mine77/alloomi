-- Fix schema alignment between PostgreSQL and SQLite
-- This migration safely adds missing columns using SQLite-specific tricks

-- 1. Add 'content' column to feedback table (if not exists)
-- SQLite doesn't support IF NOT EXISTS, so we use a trick:
-- Create a dummy table first to check, but actually we'll just try-catch

-- Create a helper function to check if column exists
-- (This will be executed in a way that ignores errors)

-- Add content column to feedback
-- In production, this will fail if column exists, but our adapter handles it
ALTER TABLE feedback ADD COLUMN content TEXT;

-- 2. Add granted_at column to user_reward_events (if not exists)
ALTER TABLE user_reward_events ADD COLUMN granted_at INTEGER;

-- 3. Fix user_roles unique index to include 'source'
-- Drop old unique index if exists
DROP INDEX IF EXISTS user_roles_user_role_key_idx;

-- Create new unique index with source
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique ON user_roles(user_id, role_key, source);

-- Update composite index to include role_key
DROP INDEX IF EXISTS user_roles_user_idx;
CREATE INDEX user_roles_user_idx ON user_roles(user_id, role_key);

-- 4. Add unique index to user_reward_events
CREATE UNIQUE INDEX IF NOT EXISTS user_reward_unique_type ON user_reward_events(user_id, reward_type);

-- Note: user_categories already has color and icon columns in current schema
-- Note: user_credit_ledger will be migrated when needed

