CREATE TABLE IF NOT EXISTS "user_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer,
	"source" varchar(32) DEFAULT 'reward' NOT NULL,
	"reward_event_id" uuid,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_reward_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_type" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'available' NOT NULL,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"trigger_reference" text,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"expires_at" timestamp with time zone,
	"granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credit_ledger" ADD CONSTRAINT "user_credit_ledger_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credit_ledger" ADD CONSTRAINT "user_credit_ledger_reward_event_id_user_reward_events_id_fk" FOREIGN KEY ("reward_event_id") REFERENCES "public"."user_reward_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_events" ADD CONSTRAINT "user_reward_events_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_credit_ledger_user_idx" ON "user_credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_credit_ledger_reward_idx" ON "user_credit_ledger" USING btree ("reward_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_reward_unique_type" ON "user_reward_events" USING btree ("user_id","reward_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reward_status_idx" ON "user_reward_events" USING btree ("user_id","status");