CREATE TABLE IF NOT EXISTS "code_snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"best_practice_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'typescript' NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_snippets" ADD CONSTRAINT "code_snippets_best_practice_id_best_practices_id_fk" FOREIGN KEY ("best_practice_id") REFERENCES "public"."best_practices"("id") ON DELETE cascade ON UPDATE no action;
