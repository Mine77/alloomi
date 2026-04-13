CREATE TABLE IF NOT EXISTS "bots" (
	"uuid" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"adapter" varchar(255) NOT NULL,
	"adapter_config" json NOT NULL,
	"enable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bots_uuid_pk" PRIMARY KEY("uuid"),
	CONSTRAINT "bots_uuid_unique" UNIQUE("uuid")
);
