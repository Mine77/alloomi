-- Recreate user_credit_ledger table with correct schema
-- The initial migration had a different schema that didn't match the code

-- Drop old table and indexes
DROP INDEX IF EXISTS user_credit_ledger_user_created_idx;
DROP INDEX IF EXISTS user_credit_ledger_user_idx;
DROP TABLE IF EXISTS user_credit_ledger;

-- Create table with correct schema
CREATE TABLE user_credit_ledger (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  delta integer NOT NULL,
  balance_after integer,
  source text DEFAULT 'reward' NOT NULL,
  reward_event_id text,
  metadata text,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_event_id) REFERENCES user_reward_events(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX user_credit_ledger_user_idx ON user_credit_ledger(user_id);
CREATE INDEX user_credit_ledger_user_created_idx ON user_credit_ledger(user_id, created_at);
