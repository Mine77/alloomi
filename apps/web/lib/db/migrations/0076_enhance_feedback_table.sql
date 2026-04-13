-- Enhance feedback table to support anonymous feedback and additional metadata
-- This migration adds support for:
-- 1. Anonymous feedback (userId is now nullable)
-- 2. Optional contact email for follow-up
-- 3. Rich metadata (type, status, priority, source, system info)
-- 4. Timestamps (created_at, updated_at)

-- Make user_id nullable to support anonymous feedback
ALTER TABLE "feedback" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add contact email for anonymous users or follow-up
ALTER TABLE "feedback" ADD COLUMN "contact_email" text;

-- Add feedback type (bug, feature, improvement, general)
ALTER TABLE "feedback" ADD COLUMN "type" text NOT NULL DEFAULT 'general';

-- Add title (short summary)
ALTER TABLE "feedback" ADD COLUMN "title" text NOT NULL DEFAULT '';

-- Add description (detailed content, same as content for now)
ALTER TABLE "feedback" ADD COLUMN "description" text NOT NULL DEFAULT '';

-- Add status tracking (open, in_progress, resolved, closed)
ALTER TABLE "feedback" ADD COLUMN "status" text NOT NULL DEFAULT 'open';

-- Add priority level (low, medium, high, urgent)
ALTER TABLE "feedback" ADD COLUMN "priority" text DEFAULT 'medium';

-- Add source tracking (web, desktop, api)
ALTER TABLE "feedback" ADD COLUMN "source" text DEFAULT 'web';

-- Add system information (JSON) for desktop app context
ALTER TABLE "feedback" ADD COLUMN "system_info" json;

-- Add updated_at timestamp for tracking modifications
ALTER TABLE "feedback" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback"("status");

-- Create index on source for filtering by platform
CREATE INDEX IF NOT EXISTS "feedback_source_idx" ON "feedback"("source");

-- Add comments for documentation
COMMENT ON COLUMN "feedback"."user_id" IS 'User ID (nullable for anonymous feedback)';
COMMENT ON COLUMN "feedback"."contact_email" IS 'Contact email for anonymous users or follow-up';
COMMENT ON COLUMN "feedback"."type" IS 'Feedback type: bug, feature, improvement, general';
COMMENT ON COLUMN "feedback"."status" IS 'Feedback status: open, in_progress, resolved, closed';
COMMENT ON COLUMN "feedback"."priority" IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN "feedback"."source" IS 'Feedback source: web, desktop, api';
COMMENT ON COLUMN "feedback"."system_info" IS 'System information (JSON) for desktop app context';
