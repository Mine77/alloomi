-- Fix user_contacts table name mismatch
-- The schema defines the table as "user_meta_contacts" but the migration created "user_contacts"
-- This migration drops the incorrect table and creates the correct one

-- Drop the old incorrect table if it exists
DROP TABLE IF EXISTS `user_contacts`;

-- Create the correct table with the proper name and schema
CREATE TABLE `user_meta_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_type` text,
	`bot_id` text,
	`contact_meta` text,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_contact` ON `user_meta_contacts` (`user_id`,`bot_id`,`contact_name`);
