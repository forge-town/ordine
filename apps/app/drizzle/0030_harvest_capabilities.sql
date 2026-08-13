ALTER TABLE "connectors" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN IF NOT EXISTS "signature" text;
--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN IF NOT EXISTS "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN IF NOT EXISTS "encrypted_credentials" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connectors_signature_idx" ON "connectors" ("signature");
