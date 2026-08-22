import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { AgentRunStatusSchema } from "./AgentRunStatusSchema";
import { RuntimeEventSchema } from "./RuntimeEventSchema";

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
    permissionMode: AgentRunPermissionModeSchema.default("workspace-write"),
    networkAccess: z.boolean().default(true),
    fullAccessConfirmed: z.boolean().default(false),
    allowedTools: z.array(z.string().min(1)).default([]),
  })
  .superRefine((value, context) => {
    if (value.permissionMode === "full-access" && !value.fullAccessConfirmed) {
      context.addIssue({
        code: "custom",
        path: ["fullAccessConfirmed"],
        message: "full-access requires explicit user confirmation",
      });
    }
  });
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

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

export const AgentRunEventEnvelopeSchema = z.object({
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  event: RuntimeEventSchema,
});
export type AgentRunEventEnvelope = z.infer<typeof AgentRunEventEnvelopeSchema>;
