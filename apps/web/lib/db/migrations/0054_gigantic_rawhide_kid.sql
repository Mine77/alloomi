CREATE TABLE IF NOT EXISTS "insight_tabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" varchar(16) DEFAULT 'custom' NOT NULL,
	"filter" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_tabs" ADD CONSTRAINT "insight_tabs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insight_tabs_user_idx" ON "insight_tabs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insight_tabs_user_enabled_idx" ON "insight_tabs" USING btree ("user_id","enabled");