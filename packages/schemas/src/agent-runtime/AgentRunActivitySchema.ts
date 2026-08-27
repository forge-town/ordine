import { z } from "zod/v4";
import { AgentRuntimeSchema, type AgentRuntime } from "./AgentRuntimeSchema";
import { AgentRunStatusSchema, type AgentRunStatus } from "./AgentRunStatusSchema";
import { AgentRunUsageSchema, type AgentRunUsage } from "./AgentRunUsageSchema";

/**
 * A phase is deliberately a projection of the canonical Agent Run event
 * stream.  It is not a second wire protocol: clients can persist and render
 * this snapshot without having to replay every event first.
 */
export const AgentRunActivityPhaseSchema = z.enum([
  "queued",
  "starting",
  "initializing",
  "running",
  "thinking",
  "streaming",
  "tool",
  "waiting",
  "compacting",
  "retrying",
  "stopping",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type AgentRunActivityPhase = z.infer<typeof AgentRunActivityPhaseSchema>;

const phaseForStatus = (status: AgentRunStatus): AgentRunActivityPhase =>
  status === "cancelling" ? "stopping" : status;

export const AgentRunActivityToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startedAt: z.iso.datetime().optional(),
  completedAt: z.iso.datetime().optional(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).default("in_progress"),
  error: z.boolean().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type AgentRunActivityTool = z.infer<typeof AgentRunActivityToolSchema>;

export const AgentRunActivityArtifactOpenModeSchema = z.enum(["open", "copy_path", "download"]);
export type AgentRunActivityArtifactOpenMode = z.infer<
  typeof AgentRunActivityArtifactOpenModeSchema
>;

export const AgentRunActivityArtifactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative().nullable().default(null),
  localPath: z.string().min(1).nullable().default(null),
  remotePath: z.string().min(1).nullable().default(null),
  openModes: z.array(AgentRunActivityArtifactOpenModeSchema).default([]),
});
export type AgentRunActivityArtifact = z.infer<typeof AgentRunActivityArtifactSchema>;

export const AgentRunActivityItemSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  kind: z.enum([
    "status",
    "session",
    "message",
    "tool",
    "permission",
    "retry",
    "context",
    "usage",
    "artifact",
    "diagnostic",
    "terminal",
    "control",
  ]),
  label: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type AgentRunActivityItem = z.infer<typeof AgentRunActivityItemSchema>;

export const AgentRunActivityMetricsSchema = z.object({
  eventCount: z.number().int().nonnegative().default(0),
  bytes: z.number().int().nonnegative().default(0),
  coalescedEventCount: z.number().int().nonnegative().default(0),
  unknownEventCount: z.number().int().nonnegative().default(0),
  duplicateEventCount: z.number().int().nonnegative().default(0),
  reconnectCount: z.number().int().nonnegative().default(0),
  pollingFallbackCount: z.number().int().nonnegative().default(0),
  artifactOpenFailureCount: z.number().int().nonnegative().default(0),
});
export type AgentRunActivityMetrics = z.infer<typeof AgentRunActivityMetricsSchema>;

/**
 * Client-side activity observations stay under the existing Agent Run API.
 * They are intentionally a small allow-list: no paths, PIDs, or arbitrary
 * client payloads are accepted as telemetry.
 */
export const AgentRunActivityTelemetrySchema = z.object({
  kind: z.literal("artifact_open_failed"),
});
export type AgentRunActivityTelemetry = z.infer<typeof AgentRunActivityTelemetrySchema>;

export const AgentRunActivitySnapshotSchema = z.object({
  version: z.literal(1),
  runId: z.string().min(1),
  runtime: AgentRuntimeSchema,
  phase: AgentRunActivityPhaseSchema,
  status: AgentRunStatusSchema,
  content: z.string().max(64 * 1024),
  progressMessage: z
    .string()
    .max(8 * 1024)
    .nullable()
    .default(null),
  latestSequence: z.number().int().nonnegative(),
  activeTools: z.array(AgentRunActivityToolSchema).max(100),
  completedTools: z.array(AgentRunActivityToolSchema).max(200),
  artifacts: z.array(AgentRunActivityArtifactSchema).max(200),
  usage: AgentRunUsageSchema.nullable().default(null),
  terminalMessage: z
    .string()
    .max(64 * 1024)
    .nullable()
    .default(null),
  errorCode: z.string().min(1).nullable().default(null),
  terminalAt: z.iso.datetime().nullable().default(null),
  items: z.array(AgentRunActivityItemSchema).max(200),
});
export type AgentRunActivitySnapshot = z.infer<typeof AgentRunActivitySnapshotSchema>;

export const createInitialAgentRunActivitySnapshot = (
  runId: string,
  runtime: AgentRuntime,
  status: AgentRunStatus = "queued",
): AgentRunActivitySnapshot =>
  AgentRunActivitySnapshotSchema.parse({
    version: 1,
    runId,
    runtime,
    phase: phaseForStatus(status),
    status,
    content: "",
    progressMessage: null,
    latestSequence: 0,
    activeTools: [],
    completedTools: [],
    artifacts: [],
    usage: null,
    terminalMessage: null,
    errorCode: null,
    terminalAt: null,
    items: [],
  });

export const createInitialAgentRunActivityMetrics = (): AgentRunActivityMetrics =>
  AgentRunActivityMetricsSchema.parse({});

export type AgentRunActivityPatch = {
  status?: AgentRunStatus;
  usage?: AgentRunUsage | null;
  errorCode?: string | null;
  terminalMessage?: string | null;
  terminalAt?: string | null;
};
