CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"phase" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversation_messages_pipeline_id_idx" ON "conversation_messages" USING btree ("pipeline_id");
--> statement-breakpoint
CREATE INDEX "conversation_messages_created_at_idx" ON "conversation_messages" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	"author" text NOT NULL,
	"content" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "annotations_pipeline_id_idx" ON "annotations" USING btree ("pipeline_id");
--> statement-breakpoint
CREATE INDEX "annotations_target_id_idx" ON "annotations" USING btree ("target_id");
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"cron_expression" text,
	"event_type" text,
	"event_config" jsonb,
	"input_config" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "routines_pipeline_id_idx" ON "routines" USING btree ("pipeline_id");
--> statement-breakpoint
CREATE INDEX "routines_enabled_idx" ON "routines" USING btree ("enabled");
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'needs_setup' NOT NULL,
	"scopes" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"snapshot_nodes" jsonb NOT NULL,
	"snapshot_edges" jsonb NOT NULL,
	"input_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"success_rate" numeric(5, 4),
	"avg_duration_ms" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_assets" ADD CONSTRAINT "pipeline_assets_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pipeline_assets_pipeline_id_idx" ON "pipeline_assets" USING btree ("pipeline_id");
