-- Create insight_brief_categories table
-- Stores user's manual category assignments for insights in Brief panel
CREATE TABLE IF NOT EXISTS "insight_brief_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"insight_id" text NOT NULL,
	"category" text NOT NULL,
	"dedupe_key" text,
	"title" text,
	"assigned_at" integer NOT NULL,
	"source" text NOT NULL DEFAULT 'manual',
	FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
	FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for insight_brief_categories
CREATE INDEX IF NOT EXISTS "insight_brief_categories_user_idx" ON "insight_brief_categories" ("user_id");
CREATE INDEX IF NOT EXISTS "insight_brief_categories_dedupe_idx" ON "insight_brief_categories" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "insight_brief_categories_category_idx" ON "insight_brief_categories" ("category");
CREATE INDEX IF NOT EXISTS "insight_brief_categories_assigned_at_idx" ON "insight_brief_categories" ("assigned_at");

-- Create unique constraint for user-insight combination
CREATE UNIQUE INDEX IF NOT EXISTS "insight_brief_categories_user_insight_idx"
ON "insight_brief_categories" ("user_id", "insight_id");
