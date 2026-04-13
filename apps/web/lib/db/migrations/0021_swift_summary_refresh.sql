ALTER TABLE "user_summary_settings"
ADD COLUMN "refresh_interval_minutes" integer DEFAULT 60 NOT NULL;

ALTER TABLE "user_summary_settings"
ADD COLUMN "last_message_processed_at" timestamp;

ALTER TABLE "user_summary_settings"
ADD COLUMN "last_active_at" timestamp;

ALTER TABLE "user_summary_settings"
ADD COLUMN "activity_tier" varchar(16) DEFAULT 'low' NOT NULL;
