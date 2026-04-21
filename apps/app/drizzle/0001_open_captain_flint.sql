CREATE TABLE "best_practices" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"condition" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"language" text DEFAULT 'typescript' NOT NULL,
	"code_snippet" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"pipeline_name" text NOT NULL,
	"object" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"logs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"work_id" text,
	"project_id" text,
	"pipeline_id" text,
	"logs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"pattern" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_project_id_github_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."github_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE set null ON UPDATE no action;