import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AgentApprovalStatus } from "@repo/schemas";
import { agentActionsTable } from "./agent_actions_table";
import { agentRunsTable } from "./agent_runs_table";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const agentApprovalsTable = pgTable(
  "agent_approvals",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRunsTable.id, { onDelete: "set null" }),
    actionId: text("action_id")
      .notNull()
      .references(() => agentActionsTable.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    callId: text("call_id").notNull(),
    argumentDigest: text("argument_digest").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    resourceVersion: integer("resource_version"),
    status: text("status").$type<AgentApprovalStatus>().notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    approvedAt: timestamp("approved_at"),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_approvals_action_idx").on(table.actionId),
    index("agent_approvals_thread_status_idx").on(table.threadId, table.status),
    index("agent_approvals_expires_at_idx").on(table.expiresAt),
  ],
);

export type AgentApprovalRecord = typeof agentApprovalsTable.$inferSelect;
