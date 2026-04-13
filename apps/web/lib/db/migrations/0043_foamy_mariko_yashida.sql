CREATE TABLE IF NOT EXISTS "insight_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" varchar(16),
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"source" varchar(16) DEFAULT 'user' NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_filters" ADD CONSTRAINT "insight_filters_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "insight_filters_user_slug_idx" ON "insight_filters" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insight_filters_user_idx" ON "insight_filters" USING btree ("user_id");