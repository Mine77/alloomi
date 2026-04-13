CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" varchar(32) DEFAULT 'processing' NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "processed_at" timestamp,
  CONSTRAINT "unique_stripe_event" UNIQUE ("stripe_event_id")
);
