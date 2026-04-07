ALTER TABLE "github_projects" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;