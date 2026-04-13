CREATE TABLE `Bot` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platform_account_id` text,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`adapter` text NOT NULL,
	`adapter_config` text NOT NULL,
	`enable` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_account_id`) REFERENCES `platform_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Chat` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`insight_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`insight_id`) REFERENCES `Insight`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_insights_chat_insight_idx` ON `chat_insights` (`chat_id`,`insight_id`);--> statement-breakpoint
CREATE INDEX `chat_insights_chat_idx` ON `chat_insights` (`chat_id`);--> statement-breakpoint
CREATE INDEX `chat_insights_insight_idx` ON `chat_insights` (`insight_id`);--> statement-breakpoint
CREATE TABLE `discord_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`username` text,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discord_accounts_user_idx` ON `discord_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `discord_accounts_user_discord_idx` ON `discord_accounts` (`user_id`,`discord_id`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'medium',
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_user_idx` ON `feedback` (`user_id`);--> statement-breakpoint
CREATE INDEX `feedback_status_idx` ON `feedback` (`status`);--> statement-breakpoint
CREATE TABLE `Insight` (
	`id` text PRIMARY KEY NOT NULL,
	`botId` text NOT NULL,
	`dedupe_key` text,
	`taskLabel` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`importance` text NOT NULL,
	`urgency` text NOT NULL,
	`platform` text,
	`account` text,
	`groups` text DEFAULT '[]' NOT NULL,
	`people` text DEFAULT '[]' NOT NULL,
	`time` integer NOT NULL,
	`details` text,
	`timeline` text,
	`insights` text,
	`trend_direction` text,
	`trend_confidence` text,
	`sentiment` text,
	`sentiment_confidence` text,
	`intent` text,
	`trend` text,
	`issue_status` text,
	`community_trend` text,
	`duplicate_flag` integer,
	`impact_level` text,
	`resolution_hint` text,
	`top_keywords` text DEFAULT '[]',
	`top_entities` text DEFAULT '[]',
	`top_voices` text,
	`sources` text,
	`source_concentration` text,
	`buyer_signals` text DEFAULT '[]',
	`stakeholders` text,
	`contract_status` text,
	`signal_type` text,
	`confidence` text,
	`scope` text,
	`next_actions` text,
	`follow_ups` text,
	`action_required` integer,
	`action_required_details` text,
	`is_unreplied` integer DEFAULT false,
	`my_tasks` text,
	`waiting_for_me` text,
	`waiting_for_others` text,
	`clarify_needed` integer,
	`categories` text DEFAULT '[]',
	`learning` text,
	`priority` text,
	`experiment_ideas` text,
	`executive_summary` text,
	`risk_flags` text,
	`client` text,
	`project_name` text,
	`next_milestone` text,
	`due_date` text,
	`payment_info` text,
	`entity` text,
	`why` text,
	`history_summary` text,
	`strategic` text,
	`role_attribution` text,
	`alerts` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_favorited` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`favorited_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`timeline_version` integer DEFAULT 1 NOT NULL,
	`last_timeline_update` integer
);
--> statement-breakpoint
CREATE TABLE `insight_filters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`definition` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insight_filters_user_slug_idx` ON `insight_filters` (`user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `insight_filters_user_idx` ON `insight_filters` (`user_id`);--> statement-breakpoint
CREATE TABLE `insight_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`filter_ids` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `insight_tabs_user_idx` ON `insight_tabs` (`user_id`);--> statement-breakpoint
CREATE TABLE `insight_timeline_history` (
	`id` text PRIMARY KEY NOT NULL,
	`insight_id` text NOT NULL,
	`timeline_event_id` text NOT NULL,
	`version` integer NOT NULL,
	`event_time` text,
	`summary` text NOT NULL,
	`label` text NOT NULL,
	`change_type` text NOT NULL,
	`change_reason` text NOT NULL,
	`changed_by` text DEFAULT 'system' NOT NULL,
	`previous_snapshot` text,
	`diff_summary` text,
	`created_at` integer NOT NULL,
	`source_message_id` text,
	FOREIGN KEY (`insight_id`) REFERENCES `Insight`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `timeline_history_insight_idx` ON `insight_timeline_history` (`insight_id`);--> statement-breakpoint
CREATE INDEX `timeline_history_event_idx` ON `insight_timeline_history` (`timeline_event_id`);--> statement-breakpoint
CREATE INDEX `timeline_history_created_idx` ON `insight_timeline_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `timeline_history_insight_event_idx` ON `insight_timeline_history` (`insight_id`,`timeline_event_id`);--> statement-breakpoint
CREATE TABLE `platform_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`credentials_encrypted` text NOT NULL,
	`encryption_key_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_accounts_user_platform_external_id_idx` ON `platform_accounts` (`userId`,`platform`,`external_id`);--> statement-breakpoint
CREATE INDEX `platform_accounts_user_idx` ON `platform_accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `integration_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`integration_id` text NOT NULL,
	`integration_type` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`logo_url` text,
	`config` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_catalog_slug_idx` ON `integration_catalog` (`slug`);--> statement-breakpoint
CREATE TABLE `marketing_email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`campaign_id` text,
	`subject` text NOT NULL,
	`sent_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`opened_at` integer,
	`clicked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `marketing_email_log_user_idx` ON `marketing_email_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `marketing_email_log_email_idx` ON `marketing_email_log` (`email`);--> statement-breakpoint
CREATE INDEX `marketing_email_log_sent_idx` ON `marketing_email_log` (`sent_at`);--> statement-breakpoint
CREATE TABLE `Message_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`attachments` text NOT NULL,
	`createdAt` integer NOT NULL,
	`metadata` text,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `PasswordResetToken` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PasswordResetToken_token_key` ON `PasswordResetToken` (`token`);--> statement-breakpoint
CREATE INDEX `PasswordResetToken_user_idx` ON `PasswordResetToken` (`userId`);--> statement-breakpoint
CREATE TABLE `people_graph_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `people_graph_snapshot_user_idx` ON `people_graph_snapshot` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_graph_snapshot_user_created_idx` ON `people_graph_snapshot` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `person_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`field_name` text NOT NULL,
	`field_type` text NOT NULL,
	`field_options` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `person_custom_fields_user_idx` ON `person_custom_fields` (`user_id`);--> statement-breakpoint
CREATE TABLE `rag_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`embedding` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`metadata` text,
	FOREIGN KEY (`document_id`) REFERENCES `rag_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rag_chunks_document_idx` ON `rag_chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX `rag_chunks_user_idx` ON `rag_chunks` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rag_chunks_doc_chunk_idx` ON `rag_chunks` (`document_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `rag_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `report_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `report_events_user_idx` ON `report_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `report_events_created_idx` ON `report_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `rss_items` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`guid_hash` text NOT NULL,
	`title` text,
	`summary` text,
	`content` text,
	`link` text,
	`published_at` integer,
	`fetched_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `rss_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_items_subscription_guid_idx` ON `rss_items` (`subscription_id`,`guid_hash`);--> statement-breakpoint
CREATE INDEX `rss_items_published_idx` ON `rss_items` (`published_at`);--> statement-breakpoint
CREATE TABLE `rss_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`catalog_id` text,
	`integration_account_id` text,
	`source_url` text NOT NULL,
	`title` text,
	`category` text,
	`status` text DEFAULT 'active' NOT NULL,
	`source_type` text DEFAULT 'custom' NOT NULL,
	`etag` text,
	`last_modified` text,
	`last_fetched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_id`) REFERENCES `integration_catalog`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`integration_account_id`) REFERENCES `platform_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_subscriptions_user_url_idx` ON `rss_subscriptions` (`user_id`,`source_url`);--> statement-breakpoint
CREATE TABLE `Stream` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `survey` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`industry` text NOT NULL,
	`role` text NOT NULL,
	`roles` text DEFAULT '[]',
	`other_role` text,
	`size` text NOT NULL,
	`communication_tools` text DEFAULT '[]' NOT NULL,
	`daily_messages` text NOT NULL,
	`challenges` text DEFAULT '[]' NOT NULL,
	`work_description` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `survey_user_idx` ON `survey` (`user_id`);--> statement-breakpoint
CREATE TABLE `telegram_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`telegram_id` text NOT NULL,
	`username` text,
	`access_token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_accounts_user_idx` ON `telegram_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_accounts_user_telegram_idx` ON `telegram_accounts` (`user_id`,`telegram_id`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`name` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`first_login_at` integer,
	`last_login_at` integer,
	`finish_on_boarding` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_categories_user_idx` ON `user_categories` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_categories_user_name_idx` ON `user_categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `user_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`notes` text,
	`category_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `user_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_contacts_user_idx` ON `user_contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_contacts_category_idx` ON `user_contacts` (`category_id`);--> statement-breakpoint
CREATE TABLE `user_credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`event_type` text NOT NULL,
	`reference_id` text,
	`description` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_credit_ledger_user_idx` ON `user_credit_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_credit_ledger_user_created_idx` ON `user_credit_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_email_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`preferences` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_email_preferences_user_idx` ON `user_email_preferences` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_preferences_user_email_idx` ON `user_email_preferences` (`user_id`,`email`);--> statement-breakpoint
CREATE TABLE `user_free_quota` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`total_quota` integer DEFAULT 100 NOT NULL,
	`used_quota` integer DEFAULT 0 NOT NULL,
	`last_adjusted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_free_user` ON `user_free_quota` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_insight_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`focus_people` text DEFAULT '[]' NOT NULL,
	`focus_topics` text DEFAULT '[]' NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`refresh_interval_minutes` integer DEFAULT 60 NOT NULL,
	`last_message_processed_at` integer,
	`last_active_at` integer,
	`activity_tier` text DEFAULT 'low' NOT NULL,
	`last_updated` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_monthly_quota` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`total_quota` integer NOT NULL,
	`used_quota` integer DEFAULT 0 NOT NULL,
	`reset_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_monthly_quota_user_month_idx` ON `user_monthly_quota` (`user_id`,`month`);--> statement-breakpoint
CREATE TABLE `user_reward_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reward_type` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`credits_granted` integer DEFAULT 0 NOT NULL,
	`trigger_reference` text,
	`metadata` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_reward_events_user_idx` ON `user_reward_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_reward_events_status_idx` ON `user_reward_events` (`status`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_key` text NOT NULL,
	`source` text NOT NULL,
	`confidence` text DEFAULT '0.5' NOT NULL,
	`first_detected_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_confirmed_at` integer,
	`evidence` text DEFAULT 'null',
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_roles_user_idx` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_user_role_key_idx` ON `user_roles` (`user_id`,`role_key`);--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_name` text NOT NULL,
	`start_date` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`end_date` integer,
	`is_active` integer DEFAULT true,
	`auto_renew` integer DEFAULT true,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`stripe_price_id` text,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`billing_cycle` text,
	`last_payment_date` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`affiliate_id` text,
	`affiliate_code` text,
	`affiliate_commission_rate` text,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_subscription` ON `user_subscriptions` (`user_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `Vote_v2` (
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`isUpvoted` integer NOT NULL,
	PRIMARY KEY(`chatId`, `messageId`),
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messageId`) REFERENCES `Message_v2`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weekly_report_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`report_data` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `weekly_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_report_revisions_report_idx` ON `weekly_report_revisions` (`report_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_report_revisions_report_version_idx` ON `weekly_report_revisions` (`report_id`,`version`);--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start_date` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`report_data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `weekly_reports_user_idx` ON `weekly_reports` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reports_user_week_idx` ON `weekly_reports` (`user_id`,`week_start_date`);--> statement-breakpoint
CREATE TABLE `whatsapp_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_number` text NOT NULL,
	`access_token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `whatsapp_accounts_user_idx` ON `whatsapp_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_accounts_user_phone_idx` ON `whatsapp_accounts` (`user_id`,`phone_number`);