-- Recreate user_email_preferences table with correct schema
-- The initial migration had a different schema that didn't match the code

-- Drop old table and indexes
DROP INDEX IF EXISTS user_email_preferences_user_idx;
DROP INDEX IF EXISTS user_email_preferences_user_email_idx;
DROP TABLE IF EXISTS user_email_preferences;

-- Create table with correct schema
CREATE TABLE user_email_preferences (
  user_id text PRIMARY KEY NOT NULL,
  marketing_opt_in integer DEFAULT 1 NOT NULL,
  marketing_opted_out_at integer,
  unsubscribe_token text NOT NULL,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  last_email_sent_at integer,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);

-- Create indexes
CREATE UNIQUE INDEX user_email_preferences_unsubscribe_token_key ON user_email_preferences(unsubscribe_token);
