CREATE TABLE "agent_runtimes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'claude-code' NOT NULL,
	"connection" jsonb DEFAULT '{"mode":"local"}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
