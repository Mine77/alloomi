CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"whatsapp_user_id" text NOT NULL,
	"username" text,
	"push_name" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_command_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_whatsapp_user_idx" ON "whatsapp_accounts" USING btree ("whatsapp_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_user_and_whatsapp_idx" ON "whatsapp_accounts" USING btree ("user_id","whatsapp_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_accounts_user_idx" ON "whatsapp_accounts" USING btree ("user_id");