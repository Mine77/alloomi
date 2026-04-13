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
    "requested_formats" varchar(16)[] DEFAULT ARRAY['pptx']::varchar[],
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
CREATE INDEX IF NOT EXISTS "presentation_jobs_user_idx" ON "presentation_jobs" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentation_jobs_status_idx" ON "presentation_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presentation_outlines_job_idx" ON "presentation_outlines" USING btree ("job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "presentation_artifacts_job_format_idx" ON "presentation_artifacts" USING btree ("job_id","format");
