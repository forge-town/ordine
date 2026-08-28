ALTER TABLE "agent_runs" ADD COLUMN "runtime_capabilities" jsonb;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "activity_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "activity_metrics" jsonb;
