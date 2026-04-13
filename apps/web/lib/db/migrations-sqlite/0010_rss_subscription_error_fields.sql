-- Add last error fields to rss_subscriptions for displaying fetch errors in subscription cards
-- SQLite version of migration 0074

ALTER TABLE "rss_subscriptions" ADD COLUMN "last_error_code" text;
ALTER TABLE "rss_subscriptions" ADD COLUMN "last_error_message" text;
