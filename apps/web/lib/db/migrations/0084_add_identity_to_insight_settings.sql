-- Add identity fields to user_insight_settings for personalization form
-- Migration: 0084_add_identity_to_insight_settings

ALTER TABLE user_insight_settings ADD COLUMN IF NOT EXISTS identity_industries TEXT;
ALTER TABLE user_insight_settings ADD COLUMN IF NOT EXISTS identity_work_description TEXT;
