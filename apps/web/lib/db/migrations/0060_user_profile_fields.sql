ALTER TABLE "User" ADD COLUMN "name" varchar(64);
ALTER TABLE "User" ADD COLUMN "avatar_url" text;

UPDATE "User"
SET "name" = split_part("email", '@', 1)
WHERE "name" IS NULL;
