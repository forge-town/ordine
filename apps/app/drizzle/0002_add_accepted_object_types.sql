-- The historical snapshot includes operations, but 0000/0001 never created it.
-- Preserve installations that already have the table while allowing empty-db replay.
CREATE TABLE IF NOT EXISTS "operations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'general' NOT NULL,
  "config" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "accepted_object_types" jsonb DEFAULT '["file","folder","project"]'::jsonb NOT NULL;
