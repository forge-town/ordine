CREATE TABLE "refinements" (
	"id" text PRIMARY KEY NOT NULL,
	"source_distillation_id" text NOT NULL,
	"max_rounds" integer DEFAULT 3 NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations" ALTER COLUMN "config" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "operations" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_agent_runtime" text DEFAULT 'mastra' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_api_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_model" text DEFAULT 'kimi-k2-0711-preview' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_output_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "refinements_source_distillation_id_idx" ON "refinements" USING btree ("source_distillation_id");--> statement-breakpoint
CREATE INDEX "refinements_status_idx" ON "refinements" USING btree ("status");--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "llm_provider";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "llm_api_key";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "llm_model";