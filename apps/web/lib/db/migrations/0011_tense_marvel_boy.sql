DO $$
DECLARE
    pk_name text;
BEGIN
    SELECT constraint_name
    INTO pk_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'Summary'
      AND constraint_type = 'PRIMARY KEY';

    IF pk_name IS NULL THEN
        EXECUTE 'ALTER TABLE "Summary" ADD PRIMARY KEY ("id")';
    END IF;
END $$;--> statement-breakpoint
ALTER TABLE "Summary" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
