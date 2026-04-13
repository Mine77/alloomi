CREATE TABLE IF NOT EXISTS "insight_timeline_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"timeline_event_id" text NOT NULL,
	"version" integer NOT NULL,
	"event_time" numeric DEFAULT null,
	"summary" text NOT NULL,
	"label" text NOT NULL,
	"change_type" varchar(16) NOT NULL,
	"change_reason" text NOT NULL,
	"changed_by" varchar(16) DEFAULT 'system' NOT NULL,
	"previous_snapshot" jsonb DEFAULT 'null'::jsonb,
	"diff_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_message_id" text
);
--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "timeline_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "last_timeline_update" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_timeline_history" ADD CONSTRAINT "insight_timeline_history_insight_id_Insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."Insight"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_insight_idx" ON "insight_timeline_history" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_event_idx" ON "insight_timeline_history" USING btree ("timeline_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_created_idx" ON "insight_timeline_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_history_insight_event_idx" ON "insight_timeline_history" USING btree ("insight_id","timeline_event_id");