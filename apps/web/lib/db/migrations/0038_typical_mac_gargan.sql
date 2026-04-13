ALTER TABLE "coupon_redemptions" ALTER COLUMN "stripe_checkout_session_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ALTER COLUMN "stripe_subscription_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "stripe_checkout_session_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "stripe_subscription_id" SET DATA TYPE varchar(255);