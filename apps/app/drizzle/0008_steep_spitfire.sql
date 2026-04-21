CREATE TABLE "checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"best_practice_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"check_type" text DEFAULT 'llm' NOT NULL,
	"script" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_results" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"checklist_item_id" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"output" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_best_practice_id_best_practices_id_fk" FOREIGN KEY ("best_practice_id") REFERENCES "public"."best_practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE cascade ON UPDATE no action;