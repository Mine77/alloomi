ALTER TABLE "platform_accounts" DROP CONSTRAINT "platform_accounts_user_id_User_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "platform_accounts_user_idx";--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "userId" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_accounts_user_idx" ON "platform_accounts" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "platform_accounts" DROP COLUMN IF EXISTS "user_id";