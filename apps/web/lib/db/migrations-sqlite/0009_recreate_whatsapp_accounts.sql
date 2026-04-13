-- Recreate whatsapp_accounts table to match schema definition
-- This migration drops and recreates the table with the correct structure

-- Drop old table
DROP TABLE IF EXISTS "whatsapp_accounts";

-- Create new table with correct schema
CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "whatsapp_user_id" text NOT NULL, -- Phone number
    "username" text,
    "push_name" text,
    "linked_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "last_command_at" integer,
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON UPDATE no action ON DELETE cascade
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_whatsapp_user_idx" ON "whatsapp_accounts"("whatsapp_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_user_and_whatsapp_idx" ON "whatsapp_accounts"("user_id", "whatsapp_user_id");
CREATE INDEX IF NOT EXISTS "whatsapp_accounts_user_idx" ON "whatsapp_accounts"("user_id");
