CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" varchar(64),
	"stripe_subscription_id" varchar(64),
	"stripe_customer_id" varchar(64),
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(96) NOT NULL,
	"plan_id" varchar(32),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"stripe_coupon_id" varchar(64) NOT NULL,
	"stripe_promotion_code_id" varchar(64) NOT NULL,
	"stripe_promotion_code" varchar(64) NOT NULL,
	"discount_type" varchar(16) NOT NULL,
	"percentage_off" numeric(5, 2) DEFAULT null,
	"amount_off" numeric(12, 2) DEFAULT null,
	"currency" varchar(8),
	"duration" varchar(16) DEFAULT 'once' NOT NULL,
	"duration_in_months" integer,
	"max_redemptions" integer DEFAULT 1 NOT NULL,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"activation_expires_at" timestamp with time zone,
	"assigned_user_id" uuid,
	"assigned_email" varchar(128),
	"role_tag" varchar(64),
	"label" varchar(128),
	"notes" text,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"created_by_user_id" uuid,
	"redeemed_by_user_id" uuid,
	"stripe_checkout_session_id" varchar(64),
	"stripe_subscription_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"redeemed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_assigned_user_id_User_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_user_id_User_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_redeemed_by_user_id_User_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_redemption_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_redemption_user_idx" ON "coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coupon_redemption_session_unique" ON "coupon_redemptions" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_coupon_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_plan_idx" ON "coupons" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_status_idx" ON "coupons" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_assigned_user_idx" ON "coupons" USING btree ("assigned_user_id");