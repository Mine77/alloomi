CREATE TABLE IF NOT EXISTS "dingtalk_bot_insight_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"msg_id" text NOT NULL,
	"sender_id" text,
	"sender_name" text,
	"text" text NOT NULL,
	"ts_sec" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dingtalk_bot_insight_messages" ADD CONSTRAINT "dingtalk_bot_insight_messages_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dingtalk_bot_insight_messages" ADD CONSTRAINT "dingtalk_bot_insight_messages_bot_id_Bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."Bot"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dingtalk_bot_insight_msg_bot_msgid_idx" ON "dingtalk_bot_insight_messages" USING btree ("bot_id","msg_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dingtalk_bot_insight_msg_lookup_idx" ON "dingtalk_bot_insight_messages" USING btree ("user_id","bot_id","chat_id","ts_sec");
