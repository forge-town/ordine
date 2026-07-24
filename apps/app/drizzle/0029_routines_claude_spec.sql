ALTER TABLE "routines" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
DELETE FROM "routines" WHERE "trigger_type" = 'event';
--> statement-breakpoint
-- The new cron parser only supports digits, *, /, -, comma, and whitespace.
-- Disable any routine whose expression uses the legacy extensions (L, ?, #, W)
-- or is missing, so they do not silently fail to schedule after deploy.
UPDATE "routines"
SET "enabled" = false,
  "next_run_at" = null
WHERE "cron_expression" IS NULL
  OR trim("cron_expression") = ''
  OR "cron_expression" !~ '^[0-9*,/ -]+$';
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "trigger_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_config";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routines_enabled_next_run_at_idx" ON "routines" ("enabled", "next_run_at");
