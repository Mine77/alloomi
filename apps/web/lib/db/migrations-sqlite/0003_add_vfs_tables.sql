-- Create Virtual File System table
CREATE TABLE IF NOT EXISTS virtual_file_system (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  parent_id text,
  name text NOT NULL,
  type text DEFAULT 'file' NOT NULL,
  content text,
  mime_type text,
  size_bytes integer DEFAULT 0 NOT NULL,
  metadata text,
  is_indexed integer DEFAULT 0 NOT NULL,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES virtual_file_system(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS vfs_unique_path ON virtual_file_system(user_id, parent_id, name);
CREATE INDEX IF NOT EXISTS vfs_user_idx ON virtual_file_system(user_id);
CREATE INDEX IF NOT EXISTS vfs_parent_idx ON virtual_file_system(parent_id);
CREATE INDEX IF NOT EXISTS vfs_path_idx ON virtual_file_system(user_id, parent_id, name);

-- Create VFS Operation Log table
CREATE TABLE IF NOT EXISTS vfs_operation_log (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  operation text NOT NULL,
  node_id text,
  path text NOT NULL,
  details text,
  created_by text DEFAULT 'user' NOT NULL,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES virtual_file_system(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS vfs_operation_log_user_idx ON vfs_operation_log(user_id);
CREATE INDEX IF NOT EXISTS vfs_operation_log_node_idx ON vfs_operation_log(node_id);
CREATE INDEX IF NOT EXISTS vfs_operation_log_created_at_idx ON vfs_operation_log(created_at);
