CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"llm_provider" text DEFAULT 'kimi' NOT NULL,
	"llm_api_key" text DEFAULT '' NOT NULL,
	"llm_model" text DEFAULT 'kimi-k2-0711-preview' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
