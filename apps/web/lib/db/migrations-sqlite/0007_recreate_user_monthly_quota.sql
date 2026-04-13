-- Recreate user_monthly_quota table with correct schema
-- The initial migration had a different schema that didn't match the code

-- Drop old table and indexes
DROP INDEX IF EXISTS user_monthly_quota_user_month_idx;
DROP INDEX IF EXISTS unique_user_month;
DROP TABLE IF EXISTS user_monthly_quota;

-- Create table with correct schema
CREATE TABLE user_monthly_quota (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  total_quota integer NOT NULL,
  used_quota integer DEFAULT 0 NOT NULL,
  is_refreshed integer DEFAULT 0 NOT NULL,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);

-- Create unique index: one user can have only one record per month
CREATE UNIQUE INDEX unique_user_month ON user_monthly_quota(user_id, year, month);
