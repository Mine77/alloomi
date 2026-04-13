-- Recreate telegram_accounts table to match schema definition
-- This migration drops and recreates the table with the correct structure

-- Drop old table
DROP TABLE IF EXISTS "telegram_accounts";

-- Create new table with correct schema
CREATE TABLE IF NOT EXISTS "telegram_accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "telegram_user_id" text NOT NULL,
    "telegram_chat_id" text NOT NULL,
    "username" text,
    "first_name" text,
    "last_name" text,
    "language_code" text,
    "is_bot" integer DEFAULT false NOT NULL,
    "linked_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "last_command_at" integer,
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON UPDATE no action ON DELETE cascade
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_telegram_user_idx" ON "telegram_accounts"("telegram_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_user_and_telegram_idx" ON "telegram_accounts"("user_id", "telegram_user_id");
CREATE INDEX IF NOT EXISTS "telegram_accounts_user_idx" ON "telegram_accounts"("user_id");
