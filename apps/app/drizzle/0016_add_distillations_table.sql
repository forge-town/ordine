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
CREATE INDEX "distillations_source_type_idx" ON "distillations" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "distillations_source_id_idx" ON "distillations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "distillations_status_idx" ON "distillations" USING btree ("status");
