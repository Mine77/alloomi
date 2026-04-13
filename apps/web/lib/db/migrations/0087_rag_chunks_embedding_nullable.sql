-- Make rag_chunks.embedding column nullable
-- This supports the skipEmbeddings option which stores chunks without vectors
-- (for text-only storage without AI embeddings API calls)

ALTER TABLE "rag_chunks" ALTER COLUMN "embedding" DROP NOT NULL;
