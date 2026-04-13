-- Add topics column to characters table for character execution focus
ALTER TABLE "characters" ADD COLUMN "topics" text NOT NULL DEFAULT '[]';
