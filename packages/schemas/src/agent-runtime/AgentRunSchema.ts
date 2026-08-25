import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { AgentRunStatusSchema } from "./AgentRunStatusSchema";
import { RuntimeEventSchema } from "./RuntimeEventSchema";
import { AgentControlEventSchema, AgentControlScopeSchema } from "../agent-control";

export const AgentRunPermissionModeSchema = z.enum(["read-only", "workspace-write", "full-access"]);
export type AgentRunPermissionMode = z.infer<typeof AgentRunPermissionModeSchema>;

export const AgentRunOwnerSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
});
export type AgentRunOwner = z.infer<typeof AgentRunOwnerSchema>;

export const AgentRunRequestSchema = z
  .object({
    owner: AgentRunOwnerSchema,
    runtimeConfigId: z.string().min(1),
    cwd: z.string().min(1),
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
    speed: z.string().min(1).optional(),
    systemPrompt: z.string().default(""),
    prompt: z.string().min(1),
    rebuildPrompt: z.string().min(1),
    resumeFromRunId: z.string().min(1).optional(),
    permissionMode: AgentRunPermissionModeSchema.default("full-access"),
    networkAccess: z.boolean().default(true),
    fullAccessConfirmed: z.boolean().default(true),
    allowedTools: z.array(z.string().min(1)).default([]),
    controlMode: z.boolean().default(false),
    controlScopes: z.array(AgentControlScopeSchema).default([]),
    firstOutputTimeoutMs: z.number().int().min(0).max(3_600_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.permissionMode === "full-access" && !value.fullAccessConfirmed) {
      context.addIssue({
        code: "custom",
        path: ["fullAccessConfirmed"],
        message: "full-access requires explicit user confirmation",
      });
    }
    if (value.controlMode && value.permissionMode !== "read-only") {
      context.addIssue({
        code: "custom",
        path: ["permissionMode"],
        message: "control-mode Agent Runs require read-only filesystem permissions",
      });
    }
    if (value.controlMode && value.allowedTools.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["allowedTools"],
        message: "control-mode Agent Runs require an explicit non-empty tool allowlist",
      });
    }
  });
export type AgentRunRequest = z.input<typeof AgentRunRequestSchema>;
export type ParsedAgentRunRequest = z.output<typeof AgentRunRequestSchema>;

export const AgentRunUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
});
export type AgentRunUsage = z.infer<typeof AgentRunUsageSchema>;

export const AgentRunSchema = z.object({
  id: z.string().min(1),
  owner: AgentRunOwnerSchema,
  runtimeConfigId: z.string().min(1),
  runtime: AgentRuntimeSchema,
  status: AgentRunStatusSchema,
  executablePath: z.string().min(1).nullable(),
  executableVersion: z.string().min(1).nullable(),
  executableFingerprint: z.string().min(1).nullable(),
  model: z.string().min(1).nullable(),
  reasoningEffort: z.string().min(1).nullable().default(null),
  speed: z.string().min(1).nullable().default(null),
  cwd: z.string().min(1),
  nativeSessionId: z.string().min(1).nullable(),
  resumeFromRunId: z.string().min(1).nullable(),
  permissionMode: AgentRunPermissionModeSchema,
  networkAccess: z.boolean(),
  controlMode: z.boolean().default(false),
  allowedTools: z.array(z.string().min(1)).default([]),
  controlScopes: z.array(AgentControlScopeSchema).default([]),
  usage: AgentRunUsageSchema.nullable(),
  resultText: z.string().nullable(),
  errorCode: z.string().min(1).nullable(),
  errorMessage: z.string().min(1).nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  firstOutputAt: z.iso.datetime().nullable(),
  lastActivityAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const AgentRunEventSchema = z.union([RuntimeEventSchema, AgentControlEventSchema]);
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;

export const AgentRunEventEnvelopeSchema = z.object({
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  event: AgentRunEventSchema,
});
export type AgentRunEventEnvelope = z.infer<typeof AgentRunEventEnvelopeSchema>;
