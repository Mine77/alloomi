DROP INDEX IF EXISTS "user_files_blob_path_idx";--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN "storage_provider" varchar(32) DEFAULT 'vercel_blob' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN "provider_file_id" text;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN "provider_metadata" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_files_provider_path_idx" ON "user_files" USING btree ("storage_provider","blob_pathname");