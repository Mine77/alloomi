CREATE TABLE IF NOT EXISTS "landing_promo_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"promo_code" varchar(64) DEFAULT '6M_FREE_PRO' NOT NULL,
	"months_granted" integer DEFAULT 6 NOT NULL,
	"plan_name" text DEFAULT 'pro' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"claimed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"referral_code" varchar(64),
	"referred_by" uuid,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "landing_promo_registrations" ADD CONSTRAINT "landing_promo_registrations_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "landing_promo_registrations" ADD CONSTRAINT "landing_promo_registrations_referred_by_landing_promo_registrations_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."landing_promo_registrations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_promo_user_idx" ON "landing_promo_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_promo_email_idx" ON "landing_promo_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_promo_code_idx" ON "landing_promo_registrations" USING btree ("promo_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_promo_status_idx" ON "landing_promo_registrations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "landing_promo_referral_code_idx" ON "landing_promo_registrations" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_promo_expires_at_idx" ON "landing_promo_registrations" USING btree ("expires_at");