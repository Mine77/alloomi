ALTER TABLE "affiliate_transactions" DROP CONSTRAINT "affiliate_transactions_subscription_id_user_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "user_subscriptions" DROP CONSTRAINT "user_subscriptions_affiliate_id_affiliates_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_transactions_affiliate_idx" ON "affiliate_transactions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_transactions_status_idx" ON "affiliate_transactions" USING btree ("affiliate_id","status");