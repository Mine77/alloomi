CREATE TABLE IF NOT EXISTS "marketing_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(128) NOT NULL,
	"stage" varchar(64) NOT NULL,
	"template" varchar(64) NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'sent' NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"token" varchar(128) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(32) NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"credentials_encrypted" text NOT NULL,
	"encryption_key_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"username" text,
	"first_name" text,
	"last_name" text,
	"language_code" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_command_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"marketing_opt_in" boolean DEFAULT true NOT NULL,
	"marketing_opted_out_at" timestamp with time zone,
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_email_sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "affiliates" ALTER COLUMN "commission_rate" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "Bot" ADD COLUMN "platform_account_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_email_log_dedupe_idx" ON "marketing_email_log" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_email_log_stage_idx" ON "marketing_email_log" USING btree ("stage","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordResetToken_user_idx" ON "PasswordResetToken" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_accounts_external_id_idx" ON "platform_accounts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_accounts_user_idx" ON "platform_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_telegram_user_idx" ON "telegram_accounts" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_accounts_user_and_telegram_idx" ON "telegram_accounts" USING btree ("user_id","telegram_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_accounts_user_idx" ON "telegram_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_preferences_unsubscribe_token_key" ON "user_email_preferences" USING btree ("unsubscribe_token");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Bot" ADD CONSTRAINT "Bot_platform_account_id_platform_accounts_id_fk" FOREIGN KEY ("platform_account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
