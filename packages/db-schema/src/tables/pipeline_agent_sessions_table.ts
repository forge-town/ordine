import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  PipelineAgentEntrypoint,
  PipelineAgentMode,
  PipelineAgentSessionStatus,
  PipelineGraphSnapshot,
} from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";

export const pipelineAgentSessionsTable = pgTable("pipeline_agent_sessions", {
  id: text("id").primaryKey(),
  entrypoint: text("entrypoint").$type<PipelineAgentEntrypoint>().notNull(),
  mode: text("mode").$type<PipelineAgentMode>().notNull(),
  status: text("status").$type<PipelineAgentSessionStatus>().notNull(),
  pipelineId: text("pipeline_id").references(() => pipelinesTable.id, { onDelete: "set null" }),
  snapshot: jsonb("snapshot").$type<PipelineGraphSnapshot | null>(),
  latestProposalId: text("latest_proposal_id"),
  approvedProposalId: text("approved_proposal_id"),
  createdPipelineId: text("created_pipeline_id").references(() => pipelinesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type PipelineAgentSessionRecord = typeof pipelineAgentSessionsTable.$inferSelect;
