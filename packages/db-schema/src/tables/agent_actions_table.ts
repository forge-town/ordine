import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AgentActionStatus, AgentControlRisk, PipelineAction } from "@repo/schemas";
import { agentChangeSetsTable } from "./agent_change_sets_table";
import { agentRunsTable } from "./agent_runs_table";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const agentActionsTable = pgTable(
  "agent_actions",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRunsTable.id, { onDelete: "set null" }),
    changeSetId: text("change_set_id").references(() => agentChangeSetsTable.id, {
      onDelete: "set null",
    }),
    sequence: serial("sequence").notNull(),
    toolName: text("tool_name").notNull(),
    risk: text("risk").$type<AgentControlRisk>().notNull(),
    status: text("status").$type<AgentActionStatus>().notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    redactedInput: jsonb("redacted_input").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    forwardAction: jsonb("forward_action").$type<PipelineAction | null>(),
    inverseActions: jsonb("inverse_actions").$type<PipelineAction[] | null>(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    uniqueIndex("agent_actions_thread_tool_idempotency_idx").on(
      table.threadId,
      table.toolName,
      table.idempotencyKey,
    ),
    index("agent_actions_change_set_sequence_idx").on(table.changeSetId, table.sequence),
    index("agent_actions_run_sequence_idx").on(table.runId, table.sequence),
  ],
);

export type AgentActionRecord = typeof agentActionsTable.$inferSelect;
