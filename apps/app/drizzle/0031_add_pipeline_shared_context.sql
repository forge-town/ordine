ALTER TABLE "pipelines" ADD COLUMN IF NOT EXISTS "shared_context" text NOT NULL DEFAULT '';
