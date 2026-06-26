CREATE TABLE "pipeline_agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"entrypoint" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"pipeline_id" text,
	"snapshot" jsonb,
	"latest_proposal_id" text,
	"approved_proposal_id" text,
	"created_pipeline_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_agent_sessions_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "pipeline_agent_sessions_created_pipeline_id_pipelines_id_fk" FOREIGN KEY ("created_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "pipeline_agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_agent_messages_session_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "pipeline_agent_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"source_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"parse_status" text NOT NULL,
	"parse_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_agent_attachments_session_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "pipeline_agent_context_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"attachment_id" text,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_agent_context_artifacts_session_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "pipeline_agent_context_artifacts_attachment_id_pipeline_agent_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."pipeline_agent_attachments"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "pipeline_agent_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_agent_proposals_session_id_pipeline_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pipeline_agent_sessions"("id") ON DELETE cascade ON UPDATE no action
);
