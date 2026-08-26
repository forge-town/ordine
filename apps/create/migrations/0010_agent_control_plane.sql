ALTER TABLE "pipeline_agent_sessions" ADD COLUMN "title" text DEFAULT 'New agent thread' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_sessions" ADD COLUMN "actor" text DEFAULT 'local-owner' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_sessions" ADD COLUMN "thread_status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_sessions" ADD COLUMN "active_context" jsonb;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_messages" ADD COLUMN "context" jsonb;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_messages" ADD COLUMN "run_id" text;
--> statement-breakpoint
ALTER TABLE "pipeline_agent_messages" ADD CONSTRAINT "pipeline_agent_messages_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "control_mode" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "control_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "executor_id" text;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "lease_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "heartbeat_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "cancel_requested_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "terminal_event_sequence" integer;
--> statement-breakpoint
CREATE TABLE "agent_change_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "run_id" text,
  "actor" text DEFAULT 'local-owner' NOT NULL,
  "kind" text DEFAULT 'agent-edit' NOT NULL,
  "origin_change_set_id" text,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "base_version" integer NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "applied_version" integer,
  "status" text DEFAULT 'drafting' NOT NULL,
  "base_snapshot" jsonb,
  "draft_snapshot" jsonb,
  "committed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "agent_change_sets_thread_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "agent_change_sets_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "agent_change_sets_actor_check" CHECK ("actor" IN ('local-owner')),
  CONSTRAINT "agent_change_sets_kind_check" CHECK ("kind" IN ('agent-edit', 'revert', 'redo')),
  CONSTRAINT "agent_change_sets_status_check" CHECK ("status" IN ('drafting', 'ready', 'applying', 'committed', 'rejected', 'rolled_back', 'reverted', 'conflicted')),
  CONSTRAINT "agent_change_sets_versions_check" CHECK ("base_version" > 0 AND ("applied_version" IS NULL OR "applied_version" > 0))
);
--> statement-breakpoint
ALTER TABLE "agent_change_sets" ADD CONSTRAINT "agent_change_sets_origin_change_set_id_fk" FOREIGN KEY ("origin_change_set_id") REFERENCES "public"."agent_change_sets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_change_sets_thread_updated_idx" ON "agent_change_sets" ("thread_id","updated_at");
--> statement-breakpoint
CREATE INDEX "agent_change_sets_target_updated_idx" ON "agent_change_sets" ("target_type","target_id","updated_at");
--> statement-breakpoint
CREATE INDEX "agent_change_sets_origin_idx" ON "agent_change_sets" ("origin_change_set_id");
--> statement-breakpoint
CREATE TABLE "agent_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "run_id" text,
  "change_set_id" text,
  "sequence" serial NOT NULL,
  "tool_name" text NOT NULL,
  "risk" text NOT NULL,
  "status" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "redacted_input" jsonb NOT NULL,
  "result" jsonb,
  "forward_action" jsonb,
  "inverse_actions" jsonb,
  "idempotency_key" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "agent_actions_thread_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "agent_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "agent_actions_change_set_id_agent_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."agent_change_sets"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "agent_actions_risk_check" CHECK ("risk" IN ('read', 'draft', 'write', 'execute', 'irreversible')),
  CONSTRAINT "agent_actions_status_check" CHECK ("status" IN ('started', 'succeeded', 'failed', 'approval_required', 'replayed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_actions_thread_tool_idempotency_idx" ON "agent_actions" ("thread_id","tool_name","idempotency_key");
--> statement-breakpoint
CREATE INDEX "agent_actions_change_set_sequence_idx" ON "agent_actions" ("change_set_id","sequence");
--> statement-breakpoint
CREATE INDEX "agent_actions_run_sequence_idx" ON "agent_actions" ("run_id","sequence");
--> statement-breakpoint
CREATE TABLE "agent_approvals" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "run_id" text,
  "action_id" text NOT NULL,
  "tool_name" text NOT NULL,
  "call_id" text NOT NULL,
  "argument_digest" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "resource_version" integer,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "approved_at" timestamp,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "agent_approvals_thread_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "agent_approvals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "agent_approvals_action_id_agent_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "agent_approvals_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'expired', 'consumed')),
  CONSTRAINT "agent_approvals_digest_check" CHECK ("argument_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_approvals_resource_version_check" CHECK ("resource_version" IS NULL OR "resource_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_approvals_action_idx" ON "agent_approvals" ("action_id");
--> statement-breakpoint
CREATE INDEX "agent_approvals_thread_status_idx" ON "agent_approvals" ("thread_id","status");
--> statement-breakpoint
CREATE INDEX "agent_approvals_expires_at_idx" ON "agent_approvals" ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_events_one_terminal_idx" ON "agent_run_events" ("run_id") WHERE "event"->>'type' = 'terminal';
