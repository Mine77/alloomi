-- Add session_version column to User for multi-device logout on password change
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 1;
