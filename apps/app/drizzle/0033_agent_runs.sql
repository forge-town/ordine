CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "runtime_config_id" text NOT NULL,
  "runtime" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "executable_path" text,
  "executable_version" text,
  "executable_fingerprint" text,
  "model" text,
  "cwd" text NOT NULL,
  "system_prompt" text DEFAULT '' NOT NULL,
  "prompt" text NOT NULL,
  "rebuild_prompt" text NOT NULL,
  "native_session_id" text,
  "resume_from_run_id" text,
  "permission_mode" text DEFAULT 'workspace-write' NOT NULL,
  "network_access" boolean DEFAULT true NOT NULL,
  "usage" jsonb,
  "result_text" text,
  "error_code" text,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "first_output_at" timestamp,
  "last_activity_at" timestamp,
  "finished_at" timestamp,
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "agent_runs_status_check" CHECK ("status" IN ('queued', 'running', 'cancelling', 'completed', 'failed', 'cancelled', 'timed_out', 'interrupted')),
  CONSTRAINT "agent_runs_permission_mode_check" CHECK ("permission_mode" IN ('read-only', 'workspace-write', 'full-access'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_run_events" (
  "sequence" serial PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "event" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_owner_idx" ON "agent_runs" USING btree ("owner_type","owner_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_expires_at_idx" ON "agent_runs" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_events_run_sequence_idx" ON "agent_run_events" USING btree ("run_id","sequence");
