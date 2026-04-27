ALTER TABLE "settings" ADD COLUMN "agent_runtimes" jsonb NOT NULL DEFAULT '[]'::jsonb;
