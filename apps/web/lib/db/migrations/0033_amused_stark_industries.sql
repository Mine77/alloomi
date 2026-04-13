CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"source" text NOT NULL,
	"confidence" numeric(5, 4) DEFAULT 0.5 NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"evidence" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Summary" RENAME TO "Insight";--> statement-breakpoint
ALTER TABLE "Insight" ALTER COLUMN "groups" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ALTER COLUMN "people" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "account" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "insights" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "trend" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "issue_status" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "community_trend" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "top_keywords" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "top_voices" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "buyer_signals" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "stakeholders" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "contract_status" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "signal_type" text;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "next_actions" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "role_attribution" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "alerts" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Insight" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN "roles" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN "other_role" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_unique" ON "user_roles" USING btree ("user_id","role_key","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("user_id","role_key");