ALTER TABLE "user_insght_settings" RENAME TO "user_insight_settings";--> statement-breakpoint
ALTER TABLE "user_insight_settings" DROP CONSTRAINT "user_insght_settings_userId_User_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_insight_settings" ADD CONSTRAINT "user_insight_settings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
