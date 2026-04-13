CREATE TABLE IF NOT EXISTS "integration_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"integration_id" varchar(32) NOT NULL,
	"integration_type" varchar(32) NOT NULL,
	"category" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"logo_url" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rss_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"guid_hash" varchar(128) NOT NULL,
	"title" text,
	"summary" text,
	"content" text,
	"link" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rss_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"catalog_id" uuid,
	"integration_account_id" uuid,
	"source_url" text NOT NULL,
	"title" text,
	"category" varchar(64),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"source_type" varchar(32) DEFAULT 'custom' NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rss_items" ADD CONSTRAINT "rss_items_subscription_id_rss_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."rss_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rss_subscriptions" ADD CONSTRAINT "rss_subscriptions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rss_subscriptions" ADD CONSTRAINT "rss_subscriptions_catalog_id_integration_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."integration_catalog"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rss_subscriptions" ADD CONSTRAINT "rss_subscriptions_integration_account_id_platform_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_catalog_slug_idx" ON "integration_catalog" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rss_items_subscription_guid_idx" ON "rss_items" USING btree ("subscription_id","guid_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rss_items_published_idx" ON "rss_items" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rss_subscriptions_user_url_idx" ON "rss_subscriptions" USING btree ("user_id","source_url");