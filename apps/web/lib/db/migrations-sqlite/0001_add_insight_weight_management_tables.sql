-- Add insight weight management tables for SQLite
-- These tables provide separation of concerns for weight-related functionality

-- Create insight_weights table
-- Stores weight-related data for insights (separate table for cleaner separation)
CREATE TABLE IF NOT EXISTS insight_weights (
	id TEXT PRIMARY KEY,
	insight_id TEXT NOT NULL REFERENCES insight(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
	custom_weight_multiplier INTEGER DEFAULT 1 NOT NULL,
	last_viewed_at INTEGER,
	last_rank_calculated_at INTEGER,
	current_event_rank INTEGER DEFAULT 0 NOT NULL,
	last_weight_adjustment_reason TEXT,
	created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
	updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Create indexes for insight_weights
CREATE UNIQUE INDEX IF NOT EXISTS weights_insight_user_idx ON insight_weights(insight_id, user_id);
CREATE INDEX IF NOT EXISTS weights_insight_idx ON insight_weights(insight_id);
CREATE INDEX IF NOT EXISTS weights_user_idx ON insight_weights(user_id);
CREATE INDEX IF NOT EXISTS weights_last_viewed_idx ON insight_weights(last_viewed_at);

-- Create insight_weight_history table
-- Tracks all weight adjustments for insights
CREATE TABLE IF NOT EXISTS insight_weight_history (
	id TEXT PRIMARY KEY,
	insight_id TEXT NOT NULL REFERENCES insight(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
	adjustment_type TEXT NOT NULL,
	weight_before TEXT NOT NULL,
	weight_after TEXT NOT NULL,
	weight_delta TEXT NOT NULL,
	custom_multiplier_before TEXT,
	custom_multiplier_after TEXT,
	reason TEXT NOT NULL,
	context TEXT,
	ip_address TEXT,
	user_agent TEXT,
	created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Create indexes for insight_weight_history
CREATE INDEX IF NOT EXISTS weight_history_insight_idx ON insight_weight_history(insight_id, created_at);
CREATE INDEX IF NOT EXISTS weight_history_user_idx ON insight_weight_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS weight_history_type_idx ON insight_weight_history(adjustment_type, created_at);

-- Create insight_view_history table
-- Tracks user views of insights
CREATE TABLE IF NOT EXISTS insight_view_history (
	id TEXT PRIMARY KEY,
	insight_id TEXT NOT NULL REFERENCES insight(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
	view_duration_seconds INTEGER,
	view_source TEXT NOT NULL,
	view_context TEXT,
	viewed_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Create indexes for insight_view_history
CREATE UNIQUE INDEX IF NOT EXISTS view_history_insight_user_time_idx ON insight_view_history(insight_id, user_id, viewed_at);
CREATE INDEX IF NOT EXISTS view_history_insight_user_idx ON insight_view_history(insight_id, user_id, viewed_at);
CREATE INDEX IF NOT EXISTS view_history_user_time_idx ON insight_view_history(user_id, viewed_at);

-- Create insight_weight_config table
-- Stores weight configuration (global and per-user)
CREATE TABLE IF NOT EXISTS insight_weight_config (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
	config_key TEXT NOT NULL,
	config_value TEXT NOT NULL,
	description TEXT,
	created_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
	updated_at INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
);

-- Create index for insight_weight_config
CREATE UNIQUE INDEX IF NOT EXISTS weight_config_user_key_idx ON insight_weight_config(user_id, config_key);

-- Insert default global configuration values
INSERT OR IGNORE INTO insight_weight_config (id, user_id, config_key, config_value, description)
VALUES
	(lower(hex(randomblob(16))), NULL, 'favorite_boost',
	 '{"multiplier": 1.5, "duration_days": 7}',
	 '收藏权重提升配置'),
	(lower(hex(randomblob(16))), NULL, 'decay_config',
	 '{"enabled": true, "threshold_days": [7, 14, 30], "rates": [0.95, 0.85, 0.7], "floor_multiplier": 0.3}',
	 '长期未查看衰减配置'),
	(lower(hex(randomblob(16))), NULL, 'view_boost',
	 '{"multiplier": 1.1, "duration_hours": 24}',
	 '查看后权重提升配置');
