-- Recreate discord_accounts table to match schema definition
-- This migration drops and recreates the table with the correct structure

-- Drop old table
DROP TABLE IF EXISTS "discord_accounts";

-- Create new table with correct schema
CREATE TABLE IF NOT EXISTS "discord_accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "discord_user_id" text NOT NULL,
    "discord_guild_id" text,
    "discord_channel_id" text,
    "username" text,
    "global_name" text,
    "linked_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "last_command_at" integer,
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON UPDATE no action ON DELETE cascade
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "discord_accounts_discord_user_idx" ON "discord_accounts"("discord_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "discord_accounts_user_and_discord_idx" ON "discord_accounts"("user_id", "discord_user_id");
CREATE INDEX IF NOT EXISTS "discord_accounts_user_idx" ON "discord_accounts"("user_id");
