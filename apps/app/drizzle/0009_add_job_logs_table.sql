CREATE TABLE "code_snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"best_practice_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'typescript' NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "works" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "works" CASCADE;--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_work_id_works_id_fk";
--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "check_script" text;--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "script_language" text DEFAULT 'typescript';--> statement-breakpoint
ALTER TABLE "rules" ADD COLUMN "accepted_object_types" jsonb DEFAULT '["file","folder","project"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "code_snippets" ADD CONSTRAINT "code_snippets_best_practice_id_best_practices_id_fk" FOREIGN KEY ("best_practice_id") REFERENCES "public"."best_practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_logs_job_id_idx" ON "job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_logs_created_at_idx" ON "job_logs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_github_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."github_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_results_job_id_idx" ON "checklist_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "checklist_results_item_id_idx" ON "checklist_results" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "jobs_project_id_idx" ON "jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "jobs_pipeline_id_idx" ON "jobs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "work_id";--> statement-breakpoint
ALTER TABLE "rules" DROP COLUMN "pattern";--> statement-breakpoint
ALTER TABLE "github_projects" ADD CONSTRAINT "github_projects_owner_repo_branch_unique" UNIQUE("owner","repo","branch");