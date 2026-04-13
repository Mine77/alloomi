ALTER TABLE "Insight" ALTER COLUMN "is_archived" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "is_favorited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "favorited_at" timestamp with time zone;