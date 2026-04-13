-- Make rag_chunks.embedding column nullable
-- This supports the skipEmbeddings option which stores chunks without vectors
-- (for text-only storage without AI embeddings API calls)

CREATE TABLE `__drizzle_new_rag_chunks` (
	`id` text PRIMARY KEY,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`embedding` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`metadata` text,
	FOREIGN KEY (`document_id`) REFERENCES `rag_documents`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);

INSERT INTO `__drizzle_new_rag_chunks` (`id`, `document_id`, `user_id`, `chunk_index`, `content`, `embedding`, `created_at`, `metadata`)
SELECT `id`, `document_id`, `user_id`, `chunk_index`, `content`, `embedding`, `created_at`, `metadata` FROM `rag_chunks`;

DROP TABLE `rag_chunks`;

ALTER TABLE `__drizzle_new_rag_chunks` RENAME TO `rag_chunks`;

CREATE INDEX `rag_chunks_document_idx` ON `rag_chunks` (`document_id`);
CREATE INDEX `rag_chunks_user_idx` ON `rag_chunks` (`user_id`);
CREATE UNIQUE INDEX `rag_chunks_doc_chunk_idx` ON `rag_chunks` (`document_id`, `chunk_index`);
