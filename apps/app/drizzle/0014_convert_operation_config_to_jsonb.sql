ALTER TABLE "operations" ALTER COLUMN "config" SET DATA TYPE jsonb USING config::jsonb;
ALTER TABLE "operations" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
ALTER TABLE "operations" ALTER COLUMN "config" SET NOT NULL;
