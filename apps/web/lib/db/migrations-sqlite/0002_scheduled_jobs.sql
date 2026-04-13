-- Create Scheduled Jobs table (SQLite version)
-- Stores cron jobs and scheduled tasks for automation

CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text,

    -- Schedule configuration
    "schedule_type" text DEFAULT 'cron' NOT NULL, -- cron | interval | once
    "cron_expression" text,
    "interval_minutes" integer,
    "scheduled_at" integer, -- Unix timestamp in milliseconds

    -- Job configuration
    "job_type" text DEFAULT 'custom' NOT NULL, -- agent | webhook | insight_refresh | custom
    "job_config" text DEFAULT '{}' NOT NULL, -- JSON string

    -- Execution settings
    "enabled" integer DEFAULT 1 NOT NULL, -- 0 = false, 1 = true
    "timezone" text DEFAULT 'UTC' NOT NULL,

    -- State tracking
    "last_run_at" integer, -- Unix timestamp in milliseconds
    "next_run_at" integer, -- Unix timestamp in milliseconds
    "last_status" text, -- success | error | running | pending
    "last_error" text,
    "run_count" integer DEFAULT 0 NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,

    -- Timestamps (Unix timestamp in milliseconds)
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);

-- Create indexes for scheduled_jobs
CREATE INDEX IF NOT EXISTS "scheduled_jobs_user_idx" ON "scheduled_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "scheduled_jobs_enabled_idx" ON "scheduled_jobs"("enabled");
CREATE INDEX IF NOT EXISTS "scheduled_jobs_next_run_idx" ON "scheduled_jobs"("next_run_at");
CREATE INDEX IF NOT EXISTS "scheduled_jobs_user_enabled_idx" ON "scheduled_jobs"("user_id", "enabled");

-- Create Job Executions table (SQLite version)
-- Logs each job execution with detailed results

CREATE TABLE IF NOT EXISTS "job_executions" (
    "id" text PRIMARY KEY,
    "job_id" text NOT NULL REFERENCES "scheduled_jobs"("id") ON DELETE CASCADE,

    -- Execution details
    "status" text NOT NULL, -- success | error | timeout
    "started_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "completed_at" integer,
    "duration_ms" integer,

    -- Result data
    "result" text, -- JSON string
    "error" text,
    "output" text,

    -- Metadata
    "triggered_by" text DEFAULT 'scheduler' NOT NULL -- scheduler | manual | api
);

-- Create indexes for job_executions
CREATE INDEX IF NOT EXISTS "job_executions_job_idx" ON "job_executions"("job_id");
CREATE INDEX IF NOT EXISTS "job_executions_started_at_idx" ON "job_executions"("started_at");
CREATE INDEX IF NOT EXISTS "job_executions_status_idx" ON "job_executions"("status");
