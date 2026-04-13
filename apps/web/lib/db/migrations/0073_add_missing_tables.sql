-- Create insight_processing_failures table
CREATE TABLE IF NOT EXISTS "insight_processing_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"failure_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"last_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_since" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Create scheduled_jobs table
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"schedule_type" varchar(20) DEFAULT 'cron' NOT NULL,
	"cron_expression" varchar(100),
	"interval_minutes" integer,
	"scheduled_at" timestamp with time zone,
	"job_type" varchar(50) DEFAULT 'custom' NOT NULL,
	"job_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_status" varchar(20),
	"last_error" text,
	"run_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Create job_executions table
CREATE TABLE IF NOT EXISTS "job_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"result" jsonb,
	"error" text,
	"output" text,
	"triggered_by" varchar(50) DEFAULT 'scheduler' NOT NULL
);
--> statement-breakpoint
-- Create whatsapp_accounts table
CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"whatsapp_user_id" text NOT NULL,
	"username" text,
	"push_name" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_command_at" timestamp with time zone
);
--> statement-breakpoint
-- Create insight_timeline_history table
CREATE TABLE IF NOT EXISTS "insight_timeline_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"timeline_event_id" text NOT NULL,
	"version" integer NOT NULL,
	"event_time" text,
	"summary" text NOT NULL,
	"label" text NOT NULL,
	"change_type" text NOT NULL,
	"change_reason" text NOT NULL,
	"changed_by" text DEFAULT 'system' NOT NULL,
	"previous_snapshot" jsonb,
	"diff_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_message_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_processing_failures" ADD CONSTRAINT "insight_processing_failures_bot_id_Bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."Bot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_job_id_scheduled_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scheduled_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_timeline_history" ADD CONSTRAINT "insight_timeline_history_insight_id_Insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."Insight"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "insight_failures_bot_group_idx" ON "insight_processing_failures" USING btree ("bot_id","group_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insight_failures_bot_status_idx" ON "insight_processing_failures" USING btree ("bot_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insight_failures_attempted_idx" ON "insight_processing_failures" USING btree ("last_attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_user_idx" ON "scheduled_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_enabled_idx" ON "scheduled_jobs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_next_run_idx" ON "scheduled_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_user_enabled_idx" ON "scheduled_jobs" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_executions_job_idx" ON "job_executions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_executions_started_at_idx" ON "job_executions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_executions_status_idx" ON "job_executions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_whatsapp_user_idx" ON "whatsapp_accounts" USING btree ("whatsapp_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_user_and_whatsapp_idx" ON "whatsapp_accounts" USING btree ("user_id","whatsapp_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_accounts_user_idx" ON "whatsapp_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_insight_idx" ON "insight_timeline_history" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_event_idx" ON "insight_timeline_history" USING btree ("timeline_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_created_idx" ON "insight_timeline_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_insight_event_idx" ON "insight_timeline_history" USING btree ("insight_id","timeline_event_id");
