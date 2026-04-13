CREATE TABLE IF NOT EXISTS "Summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"botId" uuid NOT NULL,
	"taskLabel" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"importance" varchar(10) NOT NULL,
	"urgency" varchar(10) NOT NULL,
	"channel" text NOT NULL,
	"groups" json[] NOT NULL,
	"people" json[] NOT NULL,
	"time" timestamp NOT NULL
);
