CREATE TABLE IF NOT EXISTS `dingtalk_bot_insight_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `bot_id` text NOT NULL,
  `chat_id` text NOT NULL,
  `msg_id` text NOT NULL,
  `sender_id` text,
  `sender_name` text,
  `text` text NOT NULL,
  `ts_sec` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`bot_id`) REFERENCES `Bot`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `dingtalk_bot_insight_msg_bot_msgid_idx`
  ON `dingtalk_bot_insight_messages` (`bot_id`, `msg_id`);

CREATE INDEX IF NOT EXISTS `dingtalk_bot_insight_msg_lookup_idx`
  ON `dingtalk_bot_insight_messages` (`user_id`, `bot_id`, `chat_id`, `ts_sec`);
