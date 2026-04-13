CREATE TABLE IF NOT EXISTS "user_meta_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"contact_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_type" text,
	"bot_id" text,
	"contact_meta" jsonb DEFAULT 'null'::jsonb
);

DO $$ BEGIN
 ALTER TABLE "user_meta_contacts" ADD CONSTRAINT "user_meta_contacts_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_contact" ON "user_meta_contacts" USING btree ("userId","bot_id","contact_name");