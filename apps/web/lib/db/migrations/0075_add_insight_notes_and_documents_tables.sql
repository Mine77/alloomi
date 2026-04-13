-- Create insight_notes table
CREATE TABLE IF NOT EXISTS "insight_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"source_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for insight_notes
CREATE INDEX IF NOT EXISTS "insight_notes_insight_idx" ON "insight_notes" ("insight_id");
CREATE INDEX IF NOT EXISTS "insight_notes_user_idx" ON "insight_notes" ("user_id");
CREATE INDEX IF NOT EXISTS "insight_notes_created_at_idx" ON "insight_notes" ("created_at");

-- Add foreign key constraints for insight_notes
DO $$ BEGIN
	ALTER TABLE "insight_notes" ADD CONSTRAINT "insight_notes_insight_id_fkey"
		FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_notes" ADD CONSTRAINT "insight_notes_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Create insight_documents table
CREATE TABLE IF NOT EXISTS "insight_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for insight_documents
CREATE INDEX IF NOT EXISTS "insight_documents_insight_idx" ON "insight_documents" ("insight_id");
CREATE INDEX IF NOT EXISTS "insight_documents_document_idx" ON "insight_documents" ("document_id");
CREATE INDEX IF NOT EXISTS "insight_documents_user_idx" ON "insight_documents" ("user_id");

-- Add unique constraint for insight_documents
CREATE UNIQUE INDEX IF NOT EXISTS "unique_insight_document" ON "insight_documents" ("insight_id", "document_id");

-- Add foreign key constraints for insight_documents
DO $$ BEGIN
	ALTER TABLE "insight_documents" ADD CONSTRAINT "insight_documents_insight_id_fkey"
		FOREIGN KEY ("insight_id") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_documents" ADD CONSTRAINT "insight_documents_document_id_fkey"
		FOREIGN KEY ("document_id") REFERENCES "rag_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

	ALTER TABLE "insight_documents" ADD CONSTRAINT "insight_documents_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
