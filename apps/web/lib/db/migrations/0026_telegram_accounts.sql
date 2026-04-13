CREATE TABLE IF NOT EXISTS "telegram_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"username" text,
	"first_name" text,
	"last_name" text,
	"language_code" text,
	"is_bot" boolean NOT NULL DEFAULT false,
	"linked_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"last_command_at" TIMESTAMPTZ
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_telegram_user_idx" ON "telegram_accounts" ("telegram_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_user_and_telegram_idx" ON "telegram_accounts" ("user_id","telegram_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_accounts_user_idx" ON "telegram_accounts" ("user_id");
