-- Add last error fields to rss_subscriptions for displaying fetch errors in subscription cards
ALTER TABLE "rss_subscriptions" ADD COLUMN IF NOT EXISTS "last_error_code" varchar(32);
ALTER TABLE "rss_subscriptions" ADD COLUMN IF NOT EXISTS "last_error_message" text;
