-- Add identity fields to user_insight_settings for personalization form
ALTER TABLE user_insight_settings ADD COLUMN identity_industries TEXT;
ALTER TABLE user_insight_settings ADD COLUMN identity_work_description TEXT;
