-- Add insight weight management tables
-- These tables provide separation of concerns for weight-related functionality

-- Create insight_weights table
-- Stores weight-related data for insights (separate table for cleaner separation)
CREATE TABLE IF NOT EXISTS "insight_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"custom_weight_multiplier" numeric(4, 2) DEFAULT 1 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"last_rank_calculated_at" timestamp with time zone,
	"current_event_rank" numeric(10, 4) DEFAULT 0 NOT NULL,
	"last_weight_adjustment_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insight_weights_custom_weight_multiplier_check" CHECK ("custom_weight_multiplier" >= 0.1 AND "custom_weight_multiplier" <= 5.0)
);

-- Create indexes for insight_weights
CREATE INDEX IF NOT EXISTS "weights_insight_idx" ON "insight_weights" ("insight_id");
CREATE INDEX IF NOT EXISTS "weights_user_idx" ON "insight_weights" ("user_id");
CREATE INDEX IF NOT EXISTS "weights_last_viewed_idx" ON "insight_weights" ("last_viewed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "weights_insight_user_idx" ON "insight_weights" ("insight_id", "user_id");

-- Add foreign key constraints for insight_weights
DO $$ BEGIN
	ALTER TABLE "insight_weights" ADD CONSTRAINT "insight_weights_insight_id_fkey"
		FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_weights" ADD CONSTRAINT "insight_weights_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Create insight_weight_history table
-- Tracks all weight adjustments for insights
CREATE TABLE IF NOT EXISTS "insight_weight_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"adjustment_type" varchar(20) NOT NULL,
	"weight_before" numeric(10, 4) NOT NULL,
	"weight_after" numeric(10, 4) NOT NULL,
	"weight_delta" numeric(10, 4) NOT NULL,
	"custom_multiplier_before" numeric(4, 2),
	"custom_multiplier_after" numeric(4, 2),
	"reason" text NOT NULL,
	"context" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for insight_weight_history
CREATE INDEX IF NOT EXISTS "weight_history_insight_idx" ON "insight_weight_history" ("insight_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "weight_history_user_idx" ON "insight_weight_history" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "weight_history_type_idx" ON "insight_weight_history" ("adjustment_type", "created_at" DESC);

-- Add foreign key constraints for insight_weight_history
DO $$ BEGIN
	ALTER TABLE "insight_weight_history" ADD CONSTRAINT "insight_weight_history_insight_id_fkey"
		FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_weight_history" ADD CONSTRAINT "insight_weight_history_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Add check constraint for adjustment_type values
DO $$ BEGIN
	ALTER TABLE "insight_weight_history" ADD CONSTRAINT "insight_weight_history_adjustment_type_check"
		CHECK ("adjustment_type" IN ('favorite', 'unfavorite', 'view', 'decay', 'manual', 'system'));
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Create insight_view_history table
-- Tracks user views of insights
CREATE TABLE IF NOT EXISTS "insight_view_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"view_duration_seconds" integer,
	"view_source" varchar(20) NOT NULL,
	"view_context" jsonb,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for insight_view_history
CREATE INDEX IF NOT EXISTS "view_history_insight_user_idx" ON "insight_view_history" ("insight_id", "user_id", "viewed_at");
CREATE INDEX IF NOT EXISTS "view_history_user_time_idx" ON "insight_view_history" ("user_id", "viewed_at");

-- Create unique constraint to prevent duplicate views at the same time
CREATE UNIQUE INDEX IF NOT EXISTS "view_history_insight_user_time_idx"
ON "insight_view_history" ("insight_id", "user_id", "viewed_at");

-- Add foreign key constraints for insight_view_history
DO $$ BEGIN
	ALTER TABLE "insight_view_history" ADD CONSTRAINT "insight_view_history_insight_id_fkey"
		FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_view_history" ADD CONSTRAINT "insight_view_history_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Add check constraint for view_source values
DO $$ BEGIN
	ALTER TABLE "insight_view_history" ADD CONSTRAINT "insight_view_history_view_source_check"
		CHECK ("view_source" IN ('list', 'detail', 'search', 'favorite'));
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Create insight_weight_config table
-- Stores weight configuration (global and per-user)
CREATE TABLE IF NOT EXISTS "insight_weight_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"config_key" varchar(50) NOT NULL,
	"config_value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique index for user+key combination
CREATE UNIQUE INDEX IF NOT EXISTS "weight_config_user_key_idx"
ON "insight_weight_config" ("user_id", "config_key");

-- Add foreign key constraint for insight_weight_config (optional, can be null for global configs)
DO $$ BEGIN
	ALTER TABLE "insight_weight_config" ADD CONSTRAINT "insight_weight_config_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Insert default global configuration values
INSERT INTO "insight_weight_config" (id, user_id, config_key, config_value, description)
VALUES
	(gen_random_uuid(), NULL, 'favorite_boost',
	 '{"multiplier": 1.5, "duration_days": 7}'::jsonb,
	 '收藏权重提升配置'),
	(gen_random_uuid(), NULL, 'decay_config',
	 '{"enabled": true, "threshold_days": [7, 14, 30], "rates": [0.95, 0.85, 0.7], "floor_multiplier": 0.3}'::jsonb,
	 '长期未查看衰减配置'),
	(gen_random_uuid(), NULL, 'view_boost',
	 '{"multiplier": 1.1, "duration_hours": 24}'::jsonb,
	 '查看后权重提升配置')
ON CONFLICT DO NOTHING; -- Prevent duplicate key errors if config already exists
