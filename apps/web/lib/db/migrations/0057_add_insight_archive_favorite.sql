-- Add isArchived and isFavorited columns to Insight table
-- Migration: 0057_add_insight_archive_favorite

-- Add archive status column, defaulting to false (not archived)
ALTER TABLE "Insight" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;

-- Add favorite status column, defaulting to false (not favorited)
ALTER TABLE "Insight" ADD COLUMN "is_favorited" boolean DEFAULT false NOT NULL;

-- Add archive timestamp column (optional, for recording archive time)
ALTER TABLE "Insight" ADD COLUMN "archived_at" timestamp with time zone;

-- Add favorite timestamp column (optional, for recording favorite time)
ALTER TABLE "Insight" ADD COLUMN "favorited_at" timestamp with time zone;

-- Create indexes to improve query performance
CREATE INDEX "insight_is_archived_idx" ON "Insight" ("is_archived");
CREATE INDEX "insight_is_favorited_idx" ON "Insight" ("is_favorited");
CREATE INDEX "insight_archived_at_idx" ON "Insight" ("archived_at");
CREATE INDEX "insight_favorited_at_idx" ON "Insight" ("favorited_at");

