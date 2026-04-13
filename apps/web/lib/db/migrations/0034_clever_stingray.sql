ALTER TABLE "Insight" ADD COLUMN "trend_direction" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "trend_confidence" numeric(5, 4) DEFAULT null;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "sentiment_confidence" numeric(5, 4) DEFAULT null;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "duplicate_flag" boolean;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "impact_level" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "resolution_hint" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "top_entities" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "sources" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "source_concentration" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "confidence" numeric(5, 4) DEFAULT null;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "follow_ups" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "action_required" boolean;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "action_required_details" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "my_tasks" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "waiting_for_me" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "waiting_for_others" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "clarify_needed" boolean;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "categories" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "learning" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "priority" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "experiment_ideas" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "executive_summary" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "risk_flags" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "client" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "project_name" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "next_milestone" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "payment_info" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "why" text;