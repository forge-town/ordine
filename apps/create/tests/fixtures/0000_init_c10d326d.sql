CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_raw_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"agent_runtime" text NOT NULL,
	"agent_id" text NOT NULL,
	"model_id" text,
	"raw_payload" jsonb NOT NULL,
	"token_input" integer,
	"token_output" integer,
	"duration_ms" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runtimes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'claude-code' NOT NULL,
	"connection" jsonb DEFAULT '{"mode":"local"}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_spans" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"raw_export_id" integer,
	"parent_span_id" integer,
	"span_type" text NOT NULL,
	"name" text NOT NULL,
	"input" text,
	"output" text,
	"model_id" text,
	"token_input" integer,
	"token_output" integer,
	"duration_ms" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_runtime" text,
	"system_prompt" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_system_prompt_max_length" CHECK (length("agents"."system_prompt") <= 10000)
);
--> statement-breakpoint
CREATE TABLE "distillation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"distillation_id" text NOT NULL,
	"input_snapshot" jsonb,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distillations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"source_label" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'pipeline' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_snapshot" jsonb,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"github_url" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_projects_owner_repo_branch_unique" UNIQUE("owner","repo","branch")
);
--> statement-breakpoint
CREATE TABLE "job_traces" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"parent_job_id" text,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accepted_object_types" jsonb DEFAULT '["file","folder","github-project"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text,
	"project_id" text,
	"input_path" text,
	"logs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeout_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refinement_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"refinement_id" text NOT NULL,
	"source_distillation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refinements" (
	"id" text PRIMARY KEY NOT NULL,
	"source_distillation_id" text NOT NULL,
	"max_rounds" integer DEFAULT 3 NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_agent_runtime" text DEFAULT 'mastra' NOT NULL,
	"default_api_key" text DEFAULT '' NOT NULL,
	"default_model" text DEFAULT 'kimi-for-coding/k2p6' NOT NULL,
	"default_output_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "operation_output_item_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_raw_exports" ADD CONSTRAINT "agent_raw_exports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_spans" ADD CONSTRAINT "agent_spans_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_spans" ADD CONSTRAINT "agent_spans_raw_export_id_agent_raw_exports_id_fk" FOREIGN KEY ("raw_export_id") REFERENCES "public"."agent_raw_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distillation_runs" ADD CONSTRAINT "distillation_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distillation_runs" ADD CONSTRAINT "distillation_runs_distillation_id_distillations_id_fk" FOREIGN KEY ("distillation_id") REFERENCES "public"."distillations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_traces" ADD CONSTRAINT "job_traces_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_project_id_github_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."github_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refinement_runs" ADD CONSTRAINT "refinement_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refinement_runs" ADD CONSTRAINT "refinement_runs_refinement_id_refinements_id_fk" FOREIGN KEY ("refinement_id") REFERENCES "public"."refinements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_raw_exports_job_id_idx" ON "agent_raw_exports" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "agent_raw_exports_created_at_idx" ON "agent_raw_exports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_spans_job_id_idx" ON "agent_spans" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "agent_spans_raw_export_id_idx" ON "agent_spans" USING btree ("raw_export_id");--> statement-breakpoint
CREATE INDEX "agent_spans_parent_span_id_idx" ON "agent_spans" USING btree ("parent_span_id");--> statement-breakpoint
CREATE INDEX "distillation_runs_distillation_id_idx" ON "distillation_runs" USING btree ("distillation_id");--> statement-breakpoint
CREATE INDEX "distillations_source_type_idx" ON "distillations" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "distillations_source_id_idx" ON "distillations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "distillations_status_idx" ON "distillations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_traces_job_id_idx" ON "job_traces" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_traces_created_at_idx" ON "job_traces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_parent_job_id_idx" ON "jobs" USING btree ("parent_job_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_id_idx" ON "pipeline_runs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_project_id_idx" ON "pipeline_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "refinement_runs_refinement_id_idx" ON "refinement_runs" USING btree ("refinement_id");--> statement-breakpoint
CREATE INDEX "refinement_runs_source_distillation_id_idx" ON "refinement_runs" USING btree ("source_distillation_id");--> statement-breakpoint
CREATE INDEX "refinements_source_distillation_id_idx" ON "refinements" USING btree ("source_distillation_id");--> statement-breakpoint
CREATE INDEX "refinements_status_idx" ON "refinements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");