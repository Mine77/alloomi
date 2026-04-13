ALTER TABLE "Insight" ADD COLUMN "timeline" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "strategic" jsonb DEFAULT 'null'::jsonb;