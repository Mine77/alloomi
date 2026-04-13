-- Add characters table: binds a scheduled job to a unique insight
CREATE TABLE IF NOT EXISTS "characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" varchar(50) NOT NULL,
  "description" text,
  "soul" text NOT NULL,
  "avatar_config" jsonb DEFAULT '{}',
  "job_id" uuid NOT NULL REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE UNIQUE,
  "insight_id" uuid NOT NULL REFERENCES "Insight"("id") ON DELETE SET NULL UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "last_execution_at" timestamptz,
  "last_execution_status" varchar(20),
  "sources" jsonb DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "characters_user_idx" ON "characters"("user_id");
