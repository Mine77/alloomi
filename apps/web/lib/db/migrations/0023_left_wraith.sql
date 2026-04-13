CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "code" varchar(64) NOT NULL,
  "slug" varchar(64),
  "commission_rate" numeric(6,4) DEFAULT '0' NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT 'null'::jsonb
);

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_id" uuid NOT NULL,
  "url" varchar(512),
  "referrer" varchar(512),
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb DEFAULT 'null'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_id" uuid NOT NULL,
  "method" varchar(32) NOT NULL,
  "destination_details" jsonb DEFAULT 'null'::jsonb,
  "currency" varchar(8) DEFAULT 'USD' NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "status" varchar(16) DEFAULT 'requested' NOT NULL,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  "remarks" text,
  "admin_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_id" uuid NOT NULL,
  "subscription_id" uuid,
  "order_id" text NOT NULL,
  "user_id" uuid,
  "plan_id" text,
  "currency" varchar(8) DEFAULT 'USD' NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "commission_rate" numeric(6,4) NOT NULL,
  "commission_amount" numeric(12,2) NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "payout_id" uuid,
  "metadata" jsonb DEFAULT 'null'::jsonb,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "affiliate_id" uuid;
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "affiliate_code" varchar(64);
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "affiliate_commission_rate" numeric(6,4) DEFAULT null;

DO $$ BEGIN
 ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_admin_user_id_User_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_payout_id_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payouts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "unique_affiliate_code" ON "affiliates" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_affiliate_slug" ON "affiliates" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_affiliate_user" ON "affiliates" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_affiliate_order" ON "affiliate_transactions" USING btree ("order_id");
CREATE INDEX IF NOT EXISTS "affiliate_transactions_affiliate_idx" ON "affiliate_transactions" USING btree ("affiliate_id");
CREATE INDEX IF NOT EXISTS "affiliate_transactions_status_idx" ON "affiliate_transactions" USING btree ("affiliate_id","status");
