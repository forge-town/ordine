ALTER TABLE "pipelines" ADD COLUMN "project_id" text;
--> statement-breakpoint
ALTER TABLE "pipelines" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
