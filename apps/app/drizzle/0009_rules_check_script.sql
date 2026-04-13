ALTER TABLE "rules" DROP COLUMN IF EXISTS "pattern";
ALTER TABLE "rules" ADD COLUMN "check_script" text;
ALTER TABLE "rules" ADD COLUMN "script_language" text DEFAULT 'bash';
ALTER TABLE "rules" ADD COLUMN "accepted_object_types" jsonb DEFAULT '["file","folder","project"]'::jsonb NOT NULL;
