ALTER TABLE "jobs" ADD COLUMN "pipeline_id" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "project_id" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "total_tokens" integer;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "total_cost" numeric(10, 4);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "triggered_by" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "node_statuses" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "jobs_pipeline_id_idx" ON "jobs" USING btree ("pipeline_id");
--> statement-breakpoint
CREATE INDEX "jobs_project_id_idx" ON "jobs" USING btree ("project_id");
