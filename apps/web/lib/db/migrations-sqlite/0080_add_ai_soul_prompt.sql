-- Add ai_soul_prompt to user_insight_settings table
-- Migration: 0079_add_ai_soul_prompt
-- Date: 2025-02-13

ALTER TABLE user_insight_settings ADD COLUMN ai_soul_prompt TEXT;
