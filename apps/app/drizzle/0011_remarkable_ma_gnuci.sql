CREATE TABLE "agent_raw_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"agent_system" text NOT NULL,
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
ALTER TABLE "settings" ALTER COLUMN "llm_provider" SET DEFAULT 'mastra';--> statement-breakpoint
ALTER TABLE "agent_raw_exports" ADD CONSTRAINT "agent_raw_exports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_spans" ADD CONSTRAINT "agent_spans_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_spans" ADD CONSTRAINT "agent_spans_raw_export_id_agent_raw_exports_id_fk" FOREIGN KEY ("raw_export_id") REFERENCES "public"."agent_raw_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_raw_exports_job_id_idx" ON "agent_raw_exports" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "agent_raw_exports_created_at_idx" ON "agent_raw_exports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_spans_job_id_idx" ON "agent_spans" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "agent_spans_raw_export_id_idx" ON "agent_spans" USING btree ("raw_export_id");--> statement-breakpoint
CREATE INDEX "agent_spans_parent_span_id_idx" ON "agent_spans" USING btree ("parent_span_id");