-- Create Insight Processing Failures table (SQLite version)
-- Records failed group processing for automatic retry mechanism

CREATE TABLE IF NOT EXISTS "insight_processing_failures" (
    "id" text PRIMARY KEY NOT NULL,
    "bot_id" text NOT NULL REFERENCES "Bot"("id") ON DELETE CASCADE,
    "group_name" text NOT NULL,
    "failure_count" integer DEFAULT 1 NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL, -- pending | retrying | skipped
    "last_error" text,
    "last_attempted_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "processed_since" integer NOT NULL,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);

-- Create unique constraint for bot + group
CREATE UNIQUE INDEX IF NOT EXISTS "insight_failures_bot_group_idx" ON "insight_processing_failures"("bot_id", "group_name");

-- Create index for fast lookup of retry candidates
CREATE INDEX IF NOT EXISTS "insight_failures_bot_status_idx" ON "insight_processing_failures"("bot_id", "status");

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS "insight_failures_attempted_idx" ON "insight_processing_failures"("last_attempted_at");
