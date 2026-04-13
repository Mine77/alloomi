CREATE TABLE IF NOT EXISTS "platform_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE cascade,
    "platform" varchar(32) NOT NULL,
    "external_id" text NOT NULL,
    "display_name" text NOT NULL,
    "status" varchar(32) NOT NULL DEFAULT 'active',
    "metadata" jsonb,
    "credentials_encrypted" text NOT NULL,
    "encryption_key_id" text,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_accounts_unique_external" ON "platform_accounts" ("user_id", "platform", "external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_accounts_user_idx" ON "platform_accounts" ("user_id");
--> statement-breakpoint
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "platform_account_id" uuid REFERENCES "platform_accounts"("id") ON DELETE cascade;
