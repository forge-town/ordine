import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";

const RuntimeEventBaseSchema = z.object({
  runtime: AgentRuntimeSchema,
  timestamp: z.iso.datetime(),
  sequence: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const RuntimeStatusEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("status"),
  phase: z.enum([
    "starting",
    "initializing",
    "running",
    "thinking",
    "waiting",
    "streaming",
    "compacting",
    "retrying",
    "stopping",
  ]),
  message: z.string().optional(),
});

const RuntimeSessionEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("session"),
  phase: z.enum(["created", "loaded", "captured"]),
  id: z.string().min(1),
});

const RuntimeTextDeltaEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("text_delta"),
  text: z.string(),
});

const RuntimeMessageEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("message"),
  text: z.string(),
});

const RuntimeThinkingDeltaEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("thinking_delta"),
  text: z.string(),
});

const RuntimeThinkingEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("thinking"),
  phase: z.enum(["started", "completed"]),
});

const RuntimeToolStartEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("tool_start"),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.unknown().optional(),
});

const RuntimeToolResultEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("tool_result"),
  id: z.string().min(1),
  output: z.unknown().optional(),
  isError: z.boolean(),
});

const RuntimeToolUpdateEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("tool_update"),
  id: z.string().min(1),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  name: z.string().min(1).optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
});

const RuntimePermissionEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("permission"),
  requestId: z.union([z.string().min(1), z.number().int()]),
  toolCallId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  options: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }),
  ),
  outcome: z.enum(["selected", "cancelled"]),
  selectedOptionId: z.string().min(1).optional(),
});

const RuntimeRetryEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("retry"),
  phase: z.enum(["starting", "succeeded", "failed", "exhausted"]),
  attempt: z.number().int().positive().optional(),
  message: z.string().min(1).optional(),
});

const RuntimeContextEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("context"),
  phase: z.enum(["compaction_started", "compaction_completed"]),
});

const RuntimeUsageEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("usage"),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  model: z.string().min(1).optional(),
});

const RuntimeArtifactEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("artifact"),
  path: z.string().min(1),
  mediaType: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
  localPath: z.string().min(1).nullable().optional(),
  remotePath: z.string().min(1).nullable().optional(),
  openModes: z.array(z.enum(["open", "copy_path", "download"])).optional(),
});

const RuntimeDiagnosticEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("diagnostic"),
  level: z.enum(["info", "warning", "error"]),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().optional(),
});

export const RuntimeTerminalStatusSchema = z.enum([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type RuntimeTerminalStatus = z.infer<typeof RuntimeTerminalStatusSchema>;

const RuntimeTerminalEventSchema = RuntimeEventBaseSchema.extend({
  type: z.literal("terminal"),
  status: RuntimeTerminalStatusSchema,
  exitCode: z.number().int().nullable().optional(),
  signal: z.string().nullable().optional(),
  resultText: z.string().optional(),
  sessionId: z.string().min(1).optional(),
});

export const RuntimeEventSchema = z.discriminatedUnion("type", [
  RuntimeStatusEventSchema,
  RuntimeSessionEventSchema,
  RuntimeTextDeltaEventSchema,
  RuntimeMessageEventSchema,
  RuntimeThinkingDeltaEventSchema,
  RuntimeThinkingEventSchema,
  RuntimeToolStartEventSchema,
  RuntimeToolUpdateEventSchema,
  RuntimeToolResultEventSchema,
  RuntimePermissionEventSchema,
  RuntimeRetryEventSchema,
  RuntimeContextEventSchema,
  RuntimeUsageEventSchema,
  RuntimeArtifactEventSchema,
  RuntimeDiagnosticEventSchema,
  RuntimeTerminalEventSchema,
]);
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

export const RuntimeExecutionResultSchema = z.object({
  text: z.string(),
  sessionId: z.string().min(1).optional(),
  terminal: RuntimeTerminalEventSchema,
  events: z.array(RuntimeEventSchema),
});
export type RuntimeExecutionResult = z.infer<typeof RuntimeExecutionResultSchema>;
