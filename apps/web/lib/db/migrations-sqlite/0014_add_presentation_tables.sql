-- Add missing presentation-related tables
-- These tables are defined in schema-sqlite.ts but were missing from migrations

-- Presentation Jobs table
CREATE TABLE IF NOT EXISTS `presentation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_type` text NOT NULL,
	`cadence` text DEFAULT 'weekly' NOT NULL,
	`time_range_start` text NOT NULL,
	`time_range_end` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` text,
	`source_filters` text,
	`style_profile` text,
	`requested_formats` text DEFAULT '["pptx"]' NOT NULL,
	`gamma_generation_id` text,
	`gamma_template_id` text,
	`gamma_status` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `presentation_jobs_user_idx` ON `presentation_jobs` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `presentation_jobs_status_idx` ON `presentation_jobs` (`status`);
--> statement-breakpoint

-- Presentation Outlines table
CREATE TABLE IF NOT EXISTS `presentation_outlines` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`event_layer` text NOT NULL,
	`knowledge_layer` text NOT NULL,
	`reasoning_layer` text NOT NULL,
	`slides` text NOT NULL,
	`timeline` text,
	`source_stats` text,
	`model_version` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `presentation_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `presentation_outlines_job_idx` ON `presentation_outlines` (`job_id`);
--> statement-breakpoint

-- Presentation Artifacts table
CREATE TABLE IF NOT EXISTS `presentation_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`format` text NOT NULL,
	`file_id` text NOT NULL,
	`provider` text DEFAULT 'gamma' NOT NULL,
	`gamma_export_url` text,
	`checksum` text,
	`size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `presentation_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `user_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `presentation_artifacts_job_format_idx` ON `presentation_artifacts` (`job_id`, `format`);
