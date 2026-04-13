ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "first_login_at" TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE "User"
ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "User"
ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "User"
ALTER COLUMN "created_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "User"
ALTER COLUMN "updated_at" SET NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_email_preferences" (
	"user_id" uuid PRIMARY KEY REFERENCES "public"."User"("id") ON DELETE cascade,
	"marketing_opt_in" boolean NOT NULL DEFAULT true,
	"marketing_opted_out_at" TIMESTAMPTZ,
	"unsubscribe_token" uuid NOT NULL DEFAULT gen_random_uuid(),
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"last_email_sent_at" TIMESTAMPTZ
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_preferences_unsubscribe_token_key" ON "user_email_preferences" ("unsubscribe_token");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "marketing_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
	"email" varchar(128) NOT NULL,
	"stage" varchar(64) NOT NULL,
	"template" varchar(64) NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL DEFAULT 'sent',
	"error" text,
	"metadata" jsonb,
	"sent_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_email_log_dedupe_idx" ON "marketing_email_log" ("user_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_email_log_stage_idx" ON "marketing_email_log" ("stage","sent_at");
