ALTER TABLE "jobs" ADD COLUMN "last_progress_at" timestamp;
--> statement-breakpoint
UPDATE "jobs"
SET "last_progress_at" = COALESCE("updated_at", "started_at", "created_at")
WHERE "last_progress_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "last_progress_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "last_progress_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "heartbeat_at" timestamp;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "lease_owner_id" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "lease_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "expiry_context" jsonb;
--> statement-breakpoint
CREATE INDEX "jobs_status_created_at_idx" ON "jobs" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX "jobs_status_last_progress_at_idx" ON "jobs" USING btree ("status", "last_progress_at");
--> statement-breakpoint
CREATE INDEX "jobs_status_lease_expires_at_idx" ON "jobs" USING btree ("status", "lease_expires_at");
