CREATE TABLE IF NOT EXISTS "discord_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_guild_id" text,
	"discord_channel_id" text,
	"username" text,
	"global_name" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_command_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discord_accounts" ADD CONSTRAINT "discord_accounts_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discord_accounts_discord_user_idx" ON "discord_accounts" USING btree ("discord_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discord_accounts_user_and_discord_idx" ON "discord_accounts" USING btree ("user_id","discord_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discord_accounts_user_idx" ON "discord_accounts" USING btree ("user_id");