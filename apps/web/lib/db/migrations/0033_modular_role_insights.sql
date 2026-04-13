BEGIN;

-- Rename Summary table to Insight and extend schema for richer insight payloads
ALTER TABLE "Summary" RENAME TO "Insight";

ALTER TABLE "Insight"
  ADD COLUMN "dedupe_key" text,
  ADD COLUMN "platform" text,
  ADD COLUMN "account" text,
  ADD COLUMN "insights" jsonb,
  ADD COLUMN "sentiment" text,
  ADD COLUMN "intent" text,
  ADD COLUMN "trend" text,
  ADD COLUMN "issue_status" text,
  ADD COLUMN "community_trend" text,
  ADD COLUMN "top_keywords" text[],
  ADD COLUMN "top_voices" jsonb,
  ADD COLUMN "buyer_signals" text[],
  ADD COLUMN "stakeholders" jsonb,
  ADD COLUMN "contract_status" text,
  ADD COLUMN "signal_type" text,
  ADD COLUMN "next_actions" jsonb,
  ADD COLUMN "role_attribution" jsonb,
  ADD COLUMN "alerts" jsonb,
  ADD COLUMN "created_at" timestamptz,
  ADD COLUMN "updated_at" timestamptz;

UPDATE "Insight"
SET
  "created_at" = COALESCE("time", NOW()),
  "updated_at" = NOW()
WHERE "created_at" IS NULL OR "updated_at" IS NULL;

ALTER TABLE "Insight"
  ALTER COLUMN "created_at" SET DEFAULT NOW(),
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET DEFAULT NOW(),
  ALTER COLUMN "updated_at" SET NOT NULL,
  ALTER COLUMN "groups" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "people" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "buyer_signals" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "top_keywords" SET DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS "insight_time_idx" ON "Insight" ("time");
CREATE INDEX IF NOT EXISTS "insight_bot_idx" ON "Insight" ("botId");
CREATE INDEX IF NOT EXISTS "insight_dedupe_idx" ON "Insight" ("dedupe_key");

-- Survey multi-role support
ALTER TABLE "survey"
  ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "other_role" text;

UPDATE "survey"
SET "roles" = ARRAY["role"]
WHERE array_length("roles", 1) = 0;

WITH role_map(old_value, new_value) AS (
  VALUES
    ('Executive / Decision Maker', 'executive'),
    ('Project / Product Manager', 'pm'),
    ('Developer / Technical Staff', 'engineer'),
    ('Marketing / Growth / Operations', 'marketing_ops'),
    ('Global Sales / BizDev', 'sales_bizdev'),
    ('Customer Support / Success', 'customer_success'),
    ('Community Manager', 'community_manager'),
    ('Remote Team Member', 'remote_worker'),
    ('Indie Maker / Founder', 'indie_founder'),
    ('Analyst / Journalist / Researcher', 'analyst_journalist'),
    ('Freelancer', 'freelancer'),
    ('Investor / Advisor', 'investor_advisor'),
    ('Information Manager / Knowledge Worker', 'info_curator'),
    ('Other', 'other')
)
UPDATE "survey" AS s
SET
  "role" = COALESCE(rm.new_value, regexp_replace(lower(s.role), '[^a-z0-9]+', '_', 'g')),
  "roles" = ARRAY[
    COALESCE(rm.new_value, regexp_replace(lower(s.role), '[^a-z0-9]+', '_', 'g'))
  ]
FROM role_map rm
WHERE s.role = rm.old_value;

UPDATE "survey"
SET
  "role" = regexp_replace(lower("role"), '[^a-z0-9]+', '_', 'g'),
  "roles" = ARRAY[regexp_replace(lower("role"), '[^a-z0-9]+', '_', 'g')]
WHERE "role" IS NOT NULL;

ALTER TABLE "survey"
  ALTER COLUMN "roles" DROP DEFAULT;

-- User roles catalogue
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role_key" text NOT NULL,
  "source" text NOT NULL,
  "confidence" numeric(5,4) NOT NULL DEFAULT 0.5000,
  "first_detected_at" timestamptz NOT NULL DEFAULT NOW(),
  "last_confirmed_at" timestamptz,
  "evidence" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_roles_unique" UNIQUE ("user_id", "role_key", "source")
);

CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" ("user_id", "role_key");

INSERT INTO "user_roles" (
  "user_id",
  "role_key",
  "source",
  "confidence",
  "first_detected_at",
  "last_confirmed_at",
  "evidence"
)
SELECT
  s.user_id,
  unnest(s.roles) AS role_key,
  'survey' AS source,
  0.9000 AS confidence,
  s.submitted_at AS first_detected_at,
  s.submitted_at AS last_confirmed_at,
  jsonb_build_object('kind', 'survey', 'surveyId', s.id) AS evidence
FROM "survey" s
ON CONFLICT ("user_id", "role_key", "source")
DO UPDATE SET
  "confidence" = EXCLUDED."confidence",
  "last_confirmed_at" = EXCLUDED."last_confirmed_at",
  "evidence" = EXCLUDED."evidence",
  "updated_at" = NOW();

COMMIT;
