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
DO $$ BEGIN
 ALTER TABLE "report_events" ADD CONSTRAINT "report_events_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
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
CREATE UNIQUE INDEX IF NOT EXISTS "report_events_user_source_idx" ON "report_events" USING btree ("user_id","source_type","source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "report_events_dedupe_idx" ON "report_events" USING btree ("user_id","dedupe_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_events_user_week_idx" ON "report_events" USING btree ("user_id","week_bucket");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_reports_user_role_range_idx" ON "weekly_reports" USING btree ("user_id","role","range_start","cadence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_reports_range_idx" ON "weekly_reports" USING btree ("user_id","range_start","range_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_report_revisions_report_idx" ON "weekly_report_revisions" USING btree ("report_id");
