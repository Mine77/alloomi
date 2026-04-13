-- Add updated_at column to rag_documents table
ALTER TABLE `rag_documents` ADD COLUMN `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL;
