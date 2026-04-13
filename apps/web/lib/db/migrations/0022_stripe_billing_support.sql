ALTER TABLE "user_subscriptions"
ADD COLUMN "stripe_subscription_id" text;

ALTER TABLE "user_subscriptions"
ADD COLUMN "stripe_customer_id" text;

ALTER TABLE "user_subscriptions"
ADD COLUMN "stripe_price_id" text;

ALTER TABLE "user_subscriptions"
ADD COLUMN "status" varchar(32) DEFAULT 'incomplete' NOT NULL;

ALTER TABLE "user_subscriptions"
ADD COLUMN "billing_cycle" varchar(16);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_stripe_subscription"
ON "user_subscriptions" ("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "user_subscriptions_customer_idx"
ON "user_subscriptions" ("stripe_customer_id");
