ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "accepted_object_types" jsonb DEFAULT '["file","folder","project"]'::jsonb NOT NULL;
