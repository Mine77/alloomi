CREATE TABLE IF NOT EXISTS "presentation_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"format" varchar(16) NOT NULL,
	"file_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'gamma' NOT NULL,
	"gamma_export_url" text,
	"checksum" varchar(128),
	"size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "presentation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_type" varchar(64) NOT NULL,
	"cadence" varchar(32) DEFAULT 'weekly' NOT NULL,
	"time_range_start" date NOT NULL,
	"time_range_end" date NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT 'null'::jsonb,
	"source_filters" jsonb DEFAULT 'null'::jsonb,
	"style_profile" jsonb DEFAULT 'null'::jsonb,
	"requested_formats" varchar(16)[] DEFAULT '{"pptx"}',
	"gamma_generation_id" text,
	"gamma_template_id" text,
	"gamma_status" jsonb DEFAULT 'null'::jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "presentation_outlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"event_layer" jsonb NOT NULL,
	"knowledge_layer" jsonb NOT NULL,
	"reasoning_layer" jsonb NOT NULL,
	"slides" jsonb NOT NULL,
	"timeline" jsonb,
	"source_stats" jsonb,
	"model_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cadence" varchar(16) DEFAULT 'weekly' NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"source_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"importance" varchar(16) DEFAULT 'medium' NOT NULL,
	"topic_key" text,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"week_bucket" date NOT NULL,
	"month_bucket" date,
	"dedupe_hash" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_report_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"snapshot_type" varchar(16) DEFAULT 'system' NOT NULL,
	"payload" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"cadence" varchar(16) DEFAULT 'weekly' NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"structured_payload" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"source_stats" jsonb DEFAULT 'null'::jsonb,
	"model_version" varchar(32) NOT NULL,
	"checksum" varchar(128)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "presentation_artifacts" ADD CONSTRAINT "presentation_artifacts_job_id_presentation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."presentation_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "presentation_artifacts" ADD CONSTRAINT "presentation_artifacts_file_id_user_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."user_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "presentation_jobs" ADD CONSTRAINT "presentation_jobs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "presentation_outlines" ADD CONSTRAINT "presentation_outlines_job_id_presentation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."presentation_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_events" ADD CONSTRAINT "report_events_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_report_revisions" ADD CONSTRAINT "weekly_report_revisions_report_id_weekly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_report_revisions" ADD CONSTRAINT "weekly_report_revisions_created_by_User_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "presentation_artifacts_job_format_idx" ON "presentation_artifacts" USING btree ("job_id","format");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentation_jobs_user_idx" ON "presentation_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentation_jobs_status_idx" ON "presentation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentation_outlines_job_idx" ON "presentation_outlines" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "report_events_user_source_idx" ON "report_events" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "report_events_dedupe_idx" ON "report_events" USING btree ("user_id","dedupe_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_events_user_week_idx" ON "report_events" USING btree ("user_id","week_bucket");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_report_revisions_report_idx" ON "weekly_report_revisions" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_reports_user_role_range_idx" ON "weekly_reports" USING btree ("user_id","role","range_start","cadence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_reports_range_idx" ON "weekly_reports" USING btree ("user_id","range_start","range_end");