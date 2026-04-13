-- Add characters table: binds a scheduled job to a unique insight
CREATE TABLE IF NOT EXISTS "characters" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "soul" text NOT NULL,
  "avatar_config" text DEFAULT '{"avatarState":0,"showBorder":true}',
  "job_id" text NOT NULL REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE UNIQUE,
  "insight_id" text NOT NULL REFERENCES "Insight"("id") ON DELETE SET NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'active',
  "last_execution_at" integer,
  "last_execution_status" text,
  "sources" text DEFAULT '[]',
  "created_at" integer NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" integer NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS "characters_user_idx" ON "characters"("user_id");
