-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create RAG documents table
CREATE TABLE IF NOT EXISTS "rag_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
    "file_name" varchar(255) NOT NULL,
    "content_type" varchar(100) NOT NULL,
    "size_bytes" bigint NOT NULL,
    "total_chunks" integer NOT NULL DEFAULT 0,
    "uploaded_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for rag_documents
CREATE INDEX IF NOT EXISTS "rag_documents_user_idx" ON "rag_documents"("user_id");
CREATE INDEX IF NOT EXISTS "rag_documents_uploaded_at_idx" ON "rag_documents"("uploaded_at");

-- Create RAG chunks table with pgvector support
CREATE TABLE IF NOT EXISTS "rag_chunks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "document_id" uuid NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
    "chunk_index" integer NOT NULL,
    "content" text NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for rag_chunks
CREATE INDEX IF NOT EXISTS "rag_chunks_document_idx" ON "rag_chunks"("document_id");
CREATE INDEX IF NOT EXISTS "rag_chunks_user_idx" ON "rag_chunks"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "rag_chunks_doc_chunk_idx" ON "rag_chunks"("document_id", "chunk_index");

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_idx" ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops);
