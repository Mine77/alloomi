ALTER TABLE "Summary" ALTER COLUMN "groups" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "Summary" ALTER COLUMN "people" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "Summary" ADD COLUMN "details" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Summary" ADD COLUMN "history_summary" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Summary" DROP COLUMN IF EXISTS "channel";