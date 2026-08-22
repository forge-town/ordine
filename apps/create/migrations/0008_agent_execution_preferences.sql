ALTER TABLE "settings" ADD COLUMN "default_agent_runtime_config_id" text;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "agent_runtime_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "reasoning_effort" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "speed" text;
