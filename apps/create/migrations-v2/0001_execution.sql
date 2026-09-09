CREATE TABLE "execution_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"run_request_id" text NOT NULL,
	"prepared_hash" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "execution_approvals_state_check" CHECK ("execution_approvals"."state" IN ('pending','approved','rejected','expired'))
);
--> statement-breakpoint
CREATE TABLE "execution_artifacts" (
	"artifact_id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"node_id" text NOT NULL,
	"port_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"storage_key" text NOT NULL,
	"state" text DEFAULT 'staged' NOT NULL,
	CONSTRAINT "execution_artifacts_metadata_check" CHECK ("execution_artifacts"."metadata"->>'artifactId' IS NOT DISTINCT FROM "execution_artifacts"."artifact_id" AND "execution_artifacts"."metadata"->>'jobId' IS NOT DISTINCT FROM "execution_artifacts"."job_id" AND "execution_artifacts"."metadata"->>'nodeId' IS NOT DISTINCT FROM "execution_artifacts"."node_id" AND "execution_artifacts"."metadata"->>'portId' IS NOT DISTINCT FROM "execution_artifacts"."port_id" AND "execution_artifacts"."metadata"->>'attemptId' IS NOT DISTINCT FROM "execution_artifacts"."attempt_id" AND "execution_artifacts"."metadata"->>'state' IS NOT DISTINCT FROM "execution_artifacts"."state"),
	CONSTRAINT "execution_artifacts_state_check" CHECK ("execution_artifacts"."state" IN ('staged','validated','published','rejected'))
);
--> statement-breakpoint
CREATE TABLE "execution_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"node_id" text,
	"attempt_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_events_attempt_node_check" CHECK ("execution_events"."attempt_id" IS NULL OR "execution_events"."node_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "execution_input_assets" (
	"artifact_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"storage_key" text NOT NULL,
	"import_request_id" uuid NOT NULL,
	"input_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"run_request_id" text NOT NULL,
	"prepared_run_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"executor_id" text,
	"generation" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"runtime_event_count" integer DEFAULT 0 NOT NULL,
	"runtime_event_bytes" integer DEFAULT 0 NOT NULL,
	"active_remaining_ms" integer DEFAULT 3600000 NOT NULL,
	"waiting_remaining_ms" integer DEFAULT 86400000 NOT NULL,
	"pause_requested_at" timestamp with time zone,
	"stop_reason" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"waiting_deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" jsonb,
	CONSTRAINT "execution_jobs_prepared_key" UNIQUE("id","prepared_run_id"),
	CONSTRAINT "execution_jobs_event_budget_check" CHECK ("execution_jobs"."runtime_event_count" >= 0 AND "execution_jobs"."runtime_event_bytes" >= 0),
	CONSTRAINT "execution_jobs_budget_check" CHECK ("execution_jobs"."active_remaining_ms" >= 0 AND "execution_jobs"."waiting_remaining_ms" >= 0 AND "execution_jobs"."revision" >= 0 AND "execution_jobs"."generation" >= 0),
	CONSTRAINT "execution_jobs_stop_reason_check" CHECK ("execution_jobs"."stop_reason" IS NULL OR "execution_jobs"."stop_reason" IN ('cancelled','timed_out')),
	CONSTRAINT "execution_jobs_state_check" CHECK ("execution_jobs"."state" IN ('queued','running','pausing','paused','waiting_for_input','cancelling','succeeded','failed','cancelled','timed_out','interrupted'))
);
--> statement-breakpoint
CREATE TABLE "execution_node_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"node_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"iteration" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"agent_run_id" text,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outputs" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "execution_node_attempts_owner_key" UNIQUE("id","job_id","node_id"),
	CONSTRAINT "execution_node_attempts_state_check" CHECK ("execution_node_attempts"."state" IN ('queued','running','waiting_for_input','succeeded','failed','skipped','cancelled','timed_out','interrupted'))
);
--> statement-breakpoint
CREATE TABLE "execution_operation_heads" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"latest_revision" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "execution_operation_heads_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "execution_operation_revisions" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"revision" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "execution_operation_revisions_pk" PRIMARY KEY("workspace_id","id","revision")
);
--> statement-breakpoint
CREATE TABLE "execution_pipeline_runs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"prepared_run_id" text NOT NULL,
	"outputs" jsonb
);
--> statement-breakpoint
CREATE TABLE "execution_pipelines" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"revision" integer NOT NULL,
	"definition" jsonb NOT NULL,
	CONSTRAINT "execution_pipelines_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "execution_prepared_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"prepared" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	CONSTRAINT "execution_prepared_runs_identity_key" UNIQUE("id","workspace_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "execution_run_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"prepared_run_id" text NOT NULL,
	"state" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_run_requests_identity_key" UNIQUE("id","workspace_id","subject_id","prepared_run_id"),
	CONSTRAINT "execution_run_requests_state_check" CHECK ("execution_run_requests"."state" IN ('awaiting_approval','accepted','rejected','expired','invalid'))
);
--> statement-breakpoint
CREATE TABLE "execution_runtime_configs" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"config" jsonb NOT NULL,
	"revision" integer NOT NULL,
	CONSTRAINT "execution_runtime_configs_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "execution_workspace_settings" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"execution_defaults" jsonb NOT NULL,
	"revision" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "execution_approvals" ADD CONSTRAINT "execution_approvals_request_fk" FOREIGN KEY ("run_request_id") REFERENCES "execution_run_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_artifacts" ADD CONSTRAINT "execution_artifacts_attempt_fk" FOREIGN KEY ("attempt_id","job_id","node_id") REFERENCES "execution_node_attempts"("id","job_id","node_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_job_fk" FOREIGN KEY ("job_id") REFERENCES "execution_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_attempt_fk" FOREIGN KEY ("attempt_id","job_id","node_id") REFERENCES "execution_node_attempts"("id","job_id","node_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_request_fk" FOREIGN KEY ("run_request_id","workspace_id","subject_id","prepared_run_id") REFERENCES "execution_run_requests"("id","workspace_id","subject_id","prepared_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_node_attempts" ADD CONSTRAINT "execution_node_attempts_job_fk" FOREIGN KEY ("job_id") REFERENCES "execution_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_operation_revisions" ADD CONSTRAINT "execution_operation_revisions_head_fk" FOREIGN KEY ("workspace_id","id") REFERENCES "execution_operation_heads"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_pipeline_runs" ADD CONSTRAINT "execution_pipeline_runs_job_fk" FOREIGN KEY ("job_id","prepared_run_id") REFERENCES "execution_jobs"("id","prepared_run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_run_requests" ADD CONSTRAINT "execution_run_requests_prepared_fk" FOREIGN KEY ("prepared_run_id","workspace_id","subject_id") REFERENCES "execution_prepared_runs"("id","workspace_id","subject_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "execution_approvals_request_idx" ON "execution_approvals" USING btree ("run_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_artifacts_storage_idx" ON "execution_artifacts" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_events_checkpoint_ack_idx" ON "execution_events" USING btree ("job_id","node_id") WHERE "execution_events"."type" = 'checkpoint_acknowledged';--> statement-breakpoint
CREATE INDEX "execution_events_job_sequence_idx" ON "execution_events" USING btree ("job_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_input_assets_storage_idx" ON "execution_input_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_input_assets_idempotency_idx" ON "execution_input_assets" USING btree ("workspace_id","subject_id","import_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_jobs_request_idx" ON "execution_jobs" USING btree ("run_request_id");--> statement-breakpoint
CREATE INDEX "execution_jobs_state_lease_idx" ON "execution_jobs" USING btree ("state","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_node_attempts_number_idx" ON "execution_node_attempts" USING btree ("job_id","node_id","iteration","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_run_requests_idempotency_idx" ON "execution_run_requests" USING btree ("workspace_id","subject_id","request_id");
