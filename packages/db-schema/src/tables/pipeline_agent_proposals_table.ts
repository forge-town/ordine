import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { PipelineAgentMode, PipelineAgentProposal, PipelineAgentProposalStatus } from "@repo/schemas";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const pipelineAgentProposalsTable = pgTable("pipeline_agent_proposals", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
  mode: text("mode").$type<PipelineAgentMode>().notNull(),
  status: text("status").$type<PipelineAgentProposalStatus>().notNull(),
  proposal: jsonb("proposal").$type<PipelineAgentProposal>().notNull(),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type PipelineAgentProposalRecord = typeof pipelineAgentProposalsTable.$inferSelect;
