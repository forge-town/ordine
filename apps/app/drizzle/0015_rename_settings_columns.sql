ALTER TABLE "settings" RENAME COLUMN "llm_provider" TO "default_agent_runtime";
ALTER TABLE "settings" RENAME COLUMN "llm_api_key" TO "default_api_key";
ALTER TABLE "settings" RENAME COLUMN "llm_model" TO "default_model";
