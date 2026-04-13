-- Create Virtual File System table
CREATE TABLE IF NOT EXISTS "virtual_file_system" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "parent_id" uuid REFERENCES "virtual_file_system"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "type" varchar NOT NULL DEFAULT 'file',
    "content" text,
    "mime_type" varchar(100),
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "metadata" jsonb,
    "is_indexed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "virtual_file_system_type_check" CHECK ("type" IN ('file', 'directory'))
);

-- Create indexes for virtual_file_system
CREATE INDEX IF NOT EXISTS "vfs_user_idx" ON "virtual_file_system"("user_id");
CREATE INDEX IF NOT EXISTS "vfs_parent_idx" ON "virtual_file_system"("parent_id");
CREATE INDEX IF NOT EXISTS "vfs_path_idx" ON "virtual_file_system"("user_id", "parent_id", "name");

-- Create unique constraint for user + parent + name
CREATE UNIQUE INDEX IF NOT EXISTS "vfs_unique_path" ON "virtual_file_system"("user_id", "parent_id", "name");

-- Create VFS Operation Log table
CREATE TABLE IF NOT EXISTS "vfs_operation_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "operation" varchar NOT NULL,
    "node_id" uuid REFERENCES "virtual_file_system"("id") ON DELETE SET NULL,
    "path" text NOT NULL,
    "details" jsonb,
    "created_by" varchar DEFAULT 'user' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "vfs_operation_log_operation_check" CHECK ("operation" IN ('create', 'read', 'update', 'delete', 'move', 'copy', 'search')),
    CONSTRAINT "vfs_operation_log_created_by_check" CHECK ("created_by" IN ('user', 'ai', 'system'))
);

-- Create index for vfs_operation_log
CREATE INDEX IF NOT EXISTS "vfs_operation_log_user_idx" ON "vfs_operation_log"("user_id");
