CREATE TABLE IF NOT EXISTS "chat_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_insights" ADD CONSTRAINT "chat_insights_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_insights" ADD CONSTRAINT "chat_insights_insight_id_Insight_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."Insight"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_insights_chat_insight_idx" ON "chat_insights" USING btree ("chat_id","insight_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_insights_chat_idx" ON "chat_insights" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_insights_insight_idx" ON "chat_insights" USING btree ("insight_id");