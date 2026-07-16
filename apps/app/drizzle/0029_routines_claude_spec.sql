ALTER TABLE "routines" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
DELETE FROM "routines" WHERE "trigger_type" = 'event';
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "trigger_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_type";
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "event_config";
