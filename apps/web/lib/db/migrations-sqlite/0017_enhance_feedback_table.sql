-- Enhance feedback table to support anonymous feedback and additional metadata
-- SQLite version of migration 0076

-- Make user_id nullable to support anonymous feedback
-- SQLite requires recreating the table to change column constraints
CREATE TABLE `feedback_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`contact_email` text,
	`content` text NOT NULL,
	`type` text NOT NULL DEFAULT 'general',
	`title` text NOT NULL DEFAULT '',
	`description` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'open',
	`priority` text DEFAULT 'medium',
	`source` text DEFAULT 'web',
	`system_info` text,
	`created_at` INTEGER DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` INTEGER DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Copy existing data to new table
INSERT INTO `feedback_new` (
	`id`, `user_id`, `content`, `type`, `title`, `description`,
	`status`, `priority`, `created_at`, `updated_at`
)
SELECT
	`id`, `user_id`, `content`,
	`type`, `title`, `description`,
	`status`, `priority`, `created_at`, `created_at` as `updated_at`
FROM `feedback`;

-- Drop old table
DROP TABLE `feedback`;

-- Rename new table to original name
ALTER TABLE `feedback_new` RENAME TO `feedback`;

-- Recreate indexes
CREATE INDEX `feedback_user_idx` ON `feedback`(`user_id`);
CREATE INDEX `feedback_status_idx` ON `feedback`(`status`);
CREATE INDEX `feedback_source_idx` ON `feedback`(`source`);
