-- Create insight_notes table
CREATE TABLE `insight_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`insight_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL DEFAULT 'manual',
	`source_message_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `insight_notes_insight_id_insight_id_fk` FOREIGN KEY (`insight_id`) REFERENCES `Insight`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT `insight_notes_user_id_User_id_fk` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Create indexes for insight_notes
CREATE INDEX `insight_notes_insight_id_idx` ON `insight_notes` (`insight_id`);
CREATE INDEX `insight_notes_user_id_idx` ON `insight_notes` (`user_id`);
CREATE INDEX `insight_notes_created_at_idx` ON `insight_notes` (`created_at`);

-- Create insight_documents table
CREATE TABLE `insight_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`insight_id` text NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `insight_documents_insight_id_insight_id_fk` FOREIGN KEY (`insight_id`) REFERENCES `Insight`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT `insight_documents_document_id_rag_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `rag_documents`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT `insight_documents_user_id_User_id_fk` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Create indexes for insight_documents
CREATE INDEX `insight_documents_insight_id_idx` ON `insight_documents` (`insight_id`);
CREATE INDEX `insight_documents_document_id_idx` ON `insight_documents` (`document_id`);
CREATE INDEX `insight_documents_user_id_idx` ON `insight_documents` (`user_id`);

-- Create unique index for insight_documents
CREATE UNIQUE INDEX `unique_insight_document` ON `insight_documents` (`insight_id`, `document_id`);
