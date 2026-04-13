-- Add blob_path column to rag_documents table
-- This stores the path to the original binary file (e.g., Vercel Blob URL or local file path)
-- so that the original file can be retrieved when saving to workspace

ALTER TABLE "rag_documents" ADD COLUMN "blob_path" text;
