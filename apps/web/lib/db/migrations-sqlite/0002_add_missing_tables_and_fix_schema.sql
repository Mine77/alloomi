-- Add user_file_usage table
CREATE TABLE IF NOT EXISTS user_file_usage (
  user_id text PRIMARY KEY NOT NULL,
  used_bytes integer DEFAULT 0 NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);

-- Add user_files table
CREATE TABLE IF NOT EXISTS user_files (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  chat_id text,
  message_id text,
  blob_url text NOT NULL,
  blob_pathname text NOT NULL,
  storage_provider text DEFAULT 'vercel_blob' NOT NULL,
  provider_file_id text,
  provider_metadata text,
  name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  saved_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (chat_id) REFERENCES Chat(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES Message_v2(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_files_user_idx ON user_files(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_files_provider_path_idx ON user_files(storage_provider, blob_pathname);

-- Drop and recreate person_custom_fields with correct schema
DROP TABLE IF EXISTS person_custom_fields;

CREATE TABLE person_custom_fields (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  person_id text NOT NULL,
  fields text DEFAULT '{}' NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id),
  UNIQUE (user_id, person_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS person_custom_fields_user_person_idx ON person_custom_fields(user_id, person_id);
