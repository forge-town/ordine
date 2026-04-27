CREATE TABLE "distillation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"distillation_id" text NOT NULL,
	"input_snapshot" jsonb,
	"result" jsonb,
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
	"tmux_session_name" text,
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
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_project_id_github_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_pipeline_id_pipelines_id_fk";
--> statement-breakpoint
DROP INDEX "jobs_project_id_idx";--> statement-breakpoint
DROP INDEX "jobs_pipeline_id_idx";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "default_model" SET DEFAULT 'kimi-for-coding/k2p6';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "parent_job_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "agent_runtimes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "distillation_runs" ADD CONSTRAINT "distillation_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distillation_runs" ADD CONSTRAINT "distillation_runs_distillation_id_distillations_id_fk" FOREIGN KEY ("distillation_id") REFERENCES "public"."distillations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_project_id_github_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."github_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refinement_runs" ADD CONSTRAINT "refinement_runs_id_jobs_id_fk" FOREIGN KEY ("id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refinement_runs" ADD CONSTRAINT "refinement_runs_refinement_id_refinements_id_fk" FOREIGN KEY ("refinement_id") REFERENCES "public"."refinements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "distillation_runs_distillation_id_idx" ON "distillation_runs" USING btree ("distillation_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_pipeline_id_idx" ON "pipeline_runs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_project_id_idx" ON "pipeline_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "refinement_runs_refinement_id_idx" ON "refinement_runs" USING btree ("refinement_id");--> statement-breakpoint
CREATE INDEX "refinement_runs_source_distillation_id_idx" ON "refinement_runs" USING btree ("source_distillation_id");--> statement-breakpoint
CREATE INDEX "jobs_parent_job_id_idx" ON "jobs" USING btree ("parent_job_id");--> statement-breakpoint
INSERT INTO "pipeline_runs" ("id", "pipeline_id", "project_id", "logs", "result", "tmux_session_name", "created_at", "updated_at")
  SELECT "id", "pipeline_id", "project_id", "logs", "result", "tmux_session_name", "created_at", "updated_at"
  FROM "jobs"
  WHERE "type" = 'pipeline_run';--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "pipeline_id";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "logs";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "result";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "tmux_session_name";