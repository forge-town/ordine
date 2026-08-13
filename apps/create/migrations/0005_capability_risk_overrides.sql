CREATE TABLE IF NOT EXISTS "capability_risk_overrides" (
	"capability_id" text PRIMARY KEY NOT NULL,
	"risk_tier" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "skills"
SET "origin" = 'builtin'
WHERE "id" IN (
	'skill-001', 'skill-002', 'skill-003', 'skill-004',
	'skill-005', 'skill-006', 'skill-007', 'skill-008',
	'skill-009', 'skill-010', 'skill-011', 'skill-012'
)
AND "origin" = 'manual'
AND "sources" = '[]'::jsonb;
