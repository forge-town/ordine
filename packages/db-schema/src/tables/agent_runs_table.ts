import { index, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  AgentControlScope,
  AgentRunPermissionMode,
  AgentRunStatus,
  AgentRunUsage,
  AgentRunActivityMetrics,
  AgentRunActivitySnapshot,
  AgentRuntime,
  RuntimeCapabilities,
} from "@repo/schemas";

export const agentRunsTable = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    runtimeConfigId: text("runtime_config_id").notNull(),
    runtime: text("runtime").$type<AgentRuntime>().notNull(),
    status: text("status").$type<AgentRunStatus>().notNull().default("queued"),
    executablePath: text("executable_path"),
    executableVersion: text("executable_version"),
    executableFingerprint: text("executable_fingerprint"),
    model: text("model"),
    reasoningEffort: text("reasoning_effort"),
    speed: text("speed"),
    cwd: text("cwd").notNull(),
    systemPrompt: text("system_prompt").notNull().default(""),
    prompt: text("prompt").notNull(),
    rebuildPrompt: text("rebuild_prompt").notNull(),
    nativeSessionId: text("native_session_id"),
    resumeFromRunId: text("resume_from_run_id"),
    permissionMode: text("permission_mode")
      .$type<AgentRunPermissionMode>()
      .notNull()
      .default("full-access"),
    networkAccess: boolean("network_access").notNull().default(true),
    controlMode: boolean("control_mode").notNull().default(false),
    allowedTools: jsonb("allowed_tools").$type<string[]>().notNull().default([]),
    controlScopes: jsonb("control_scopes").$type<AgentControlScope[]>().notNull().default([]),
    runtimeCapabilities: jsonb("runtime_capabilities").$type<RuntimeCapabilities | null>(),
    activitySnapshot: jsonb("activity_snapshot").$type<AgentRunActivitySnapshot | null>(),
    activityMetrics: jsonb("activity_metrics").$type<AgentRunActivityMetrics | null>(),
    executorId: text("executor_id"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    heartbeatAt: timestamp("heartbeat_at"),
    cancelRequestedAt: timestamp("cancel_requested_at"),
    terminalEventSequence: integer("terminal_event_sequence"),
    usage: jsonb("usage").$type<AgentRunUsage | null>(),
    resultText: text("result_text"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    firstOutputAt: timestamp("first_output_at"),
    lastActivityAt: timestamp("last_activity_at"),
    finishedAt: timestamp("finished_at"),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("agent_runs_owner_idx").on(table.ownerType, table.ownerId, table.createdAt),
    index("agent_runs_status_idx").on(table.status, table.updatedAt),
    index("agent_runs_expires_at_idx").on(table.expiresAt),
  ],
);

export type AgentRunRecord = typeof agentRunsTable.$inferSelect;
