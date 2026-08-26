import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  AgentChangeSetKind,
  AgentChangeSetStatus,
  AgentControlActor,
  PipelineGraphSnapshot,
} from "@repo/schemas";
import { agentRunsTable } from "./agent_runs_table";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const agentChangeSetsTable = pgTable(
  "agent_change_sets",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRunsTable.id, { onDelete: "set null" }),
    actor: text("actor").$type<AgentControlActor>().notNull().default("local-owner"),
    kind: text("kind").$type<AgentChangeSetKind>().notNull().default("agent-edit"),
    originChangeSetId: text("origin_change_set_id"),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    baseVersion: integer("base_version").notNull(),
    revision: integer("revision").notNull().default(0),
    appliedVersion: integer("applied_version"),
    status: text("status").$type<AgentChangeSetStatus>().notNull().default("drafting"),
    baseSnapshot: jsonb("base_snapshot").$type<PipelineGraphSnapshot | null>(),
    draftSnapshot: jsonb("draft_snapshot").$type<PipelineGraphSnapshot | null>(),
    committedAt: timestamp("committed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_change_sets_thread_updated_idx").on(table.threadId, table.updatedAt),
    index("agent_change_sets_target_updated_idx").on(
      table.targetType,
      table.targetId,
      table.updatedAt,
    ),
    index("agent_change_sets_origin_idx").on(table.originChangeSetId),
  ],
);

export type AgentChangeSetRecord = typeof agentChangeSetsTable.$inferSelect;
