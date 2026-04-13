-- Migration to add is_unreplied column to Insight table
ALTER TABLE "Insight" ADD COLUMN "is_unreplied" BOOLEAN DEFAULT false;
