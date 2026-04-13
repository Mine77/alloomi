CREATE TABLE IF NOT EXISTS "vfs_operation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" varchar NOT NULL,
	"node_id" uuid,
	"path" text NOT NULL,
	"details" jsonb DEFAULT 'null'::jsonb,
	"created_by" varchar DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "virtual_file_system" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" varchar DEFAULT 'file' NOT NULL,
	"content" text,
	"mime_type" varchar(100),
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"is_indexed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vfs_operation_log" ADD CONSTRAINT "vfs_operation_log_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vfs_operation_log" ADD CONSTRAINT "vfs_operation_log_node_id_virtual_file_system_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."virtual_file_system"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "virtual_file_system" ADD CONSTRAINT "virtual_file_system_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "virtual_file_system" ADD CONSTRAINT "virtual_file_system_parent_id_virtual_file_system_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."virtual_file_system"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vfs_operation_log_user_idx" ON "vfs_operation_log" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vfs_unique_path" ON "virtual_file_system" USING btree ("user_id","parent_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vfs_user_idx" ON "virtual_file_system" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vfs_parent_idx" ON "virtual_file_system" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vfs_path_idx" ON "virtual_file_system" USING btree ("user_id","parent_id","name");