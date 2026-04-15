ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_work_id_works_id_fk";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "work_id";--> statement-breakpoint
DROP INDEX IF EXISTS "jobs_work_id_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "works";
