ALTER TABLE "routines" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
DELETE FROM "routines" WHERE "trigger_type" = 'event';
--> statement-breakpoint
-- Disable any routine whose expression the SQL migration can prove invalid:
-- missing/empty values, wrong arity, step zero, or obvious impossible
-- single-value month/day combinations.
UPDATE "routines"
SET "enabled" = false,
  "next_run_at" = null
WHERE "cron_expression" IS NULL
  OR trim("cron_expression") = ''
  OR "cron_expression" !~ '^[0-9*,/ -]+$'
  OR array_length(regexp_split_to_array(trim("cron_expression"), '\s+'), 1) <> 5
  OR "cron_expression" ~ '(^|\s)(?:\*/0|[0-9]+-[0-9]+/0)(\s|$)'
  OR (
    split_part(trim("cron_expression"), ' ', 3) ~ '^[0-9]+$'
    AND split_part(trim("cron_expression"), ' ', 4) ~ '^[0-9]+$'
    AND (
      (split_part(trim("cron_expression"), ' ', 4)::int = 2 AND split_part(trim("cron_expression"), ' ', 3)::int > 29)
      OR (split_part(trim("cron_expression"), ' ', 4)::int IN (4, 6, 9, 11) AND split_part(trim("cron_expression"), ' ', 3)::int > 30)
      OR split_part(trim("cron_expression"), ' ', 3)::int > 31
    )
  );
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "trigger_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_config";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routines_enabled_next_run_at_idx" ON "routines" ("enabled", "next_run_at");
