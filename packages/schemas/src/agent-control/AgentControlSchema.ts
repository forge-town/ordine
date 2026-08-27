import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { PipelineActionSchema } from "../pipeline/PipelineActionSchema";
import { PipelineGraphSnapshotSchema } from "../pipeline/PipelineGraphSnapshotSchema";

export const AgentControlActorSchema = z.literal("local-owner");
export type AgentControlActor = z.infer<typeof AgentControlActorSchema>;

export const AgentControlRiskSchema = z.enum(["read", "draft", "write", "execute", "irreversible"]);
export type AgentControlRisk = z.infer<typeof AgentControlRiskSchema>;

export const AgentControlAudienceSchema = z.enum([
  "internal-run",
  "public-readwrite",
  "public-readonly",
  "stdio",
]);
export type AgentControlAudience = z.infer<typeof AgentControlAudienceSchema>;

export const AgentControlScopeSchema = z.enum([
  "resources:read",
  "resources:write",
  "canvas:read",
  "canvas:draft",
  "execute",
  "irreversible:request",
]);
export type AgentControlScope = z.infer<typeof AgentControlScopeSchema>;

export const AgentResourceTypeSchema = z.enum([
  "project",
  "pipeline",
  "operation",
  "skill",
  "agent",
  "connector",
  "routine",
  "distillation",
  "pipeline-asset",
  "job",
]);
export type AgentResourceType = z.infer<typeof AgentResourceTypeSchema>;

export const AgentResourceRefSchema = z.object({
  type: AgentResourceTypeSchema,
  id: z.string().min(1),
  label: z.string().min(1).max(240).optional(),
});
export type AgentResourceRef = z.infer<typeof AgentResourceRefSchema>;

export const AgentContextAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(255),
  artifactRef: z.string().min(1).optional(),
});
export type AgentContextAttachment = z.infer<typeof AgentContextAttachmentSchema>;

export const AgentContextEnvelopeSchema = z.object({
  route: z.object({
    pathname: z.string().min(1).max(2048),
    label: z.string().min(1).max(240).optional(),
  }),
  projectId: z.string().min(1).nullable().default(null),
  pipelineId: z.string().min(1).nullable().default(null),
  selectedResources: z.array(AgentResourceRefSchema).max(50).default([]),
  selectedNodeIds: z.array(z.string().min(1)).max(100).default([]),
  attachments: z.array(AgentContextAttachmentSchema).max(20).default([]),
  activeRun: z
    .object({
      runId: z.string().min(1),
      status: z.string().min(1),
    })
    .nullable()
    .default(null),
  capturedAt: z.iso.datetime(),
});
export type AgentContextEnvelope = z.infer<typeof AgentContextEnvelopeSchema>;

export const AgentThreadStatusSchema = z.enum(["active", "archived"]);
export type AgentThreadStatus = z.infer<typeof AgentThreadStatusSchema>;

export const AgentThreadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(240),
  actor: AgentControlActorSchema,
  status: AgentThreadStatusSchema,
  activeContext: AgentContextEnvelopeSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AgentThread = z.infer<typeof AgentThreadSchema>;

export const AgentChangeSetStatusSchema = z.enum([
  "drafting",
  "ready",
  "applying",
  "committed",
  "rejected",
  "rolled_back",
  "reverted",
  "conflicted",
]);
export type AgentChangeSetStatus = z.infer<typeof AgentChangeSetStatusSchema>;

export const AgentChangeSetKindSchema = z.enum(["agent-edit", "revert", "redo"]);
export type AgentChangeSetKind = z.infer<typeof AgentChangeSetKindSchema>;

export const AgentChangeSetSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  actor: AgentControlActorSchema,
  kind: AgentChangeSetKindSchema,
  originChangeSetId: z.string().min(1).nullable(),
  target: AgentResourceRefSchema,
  baseVersion: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  appliedVersion: z.number().int().positive().nullable(),
  status: AgentChangeSetStatusSchema,
  baseSnapshot: PipelineGraphSnapshotSchema.nullable(),
  draftSnapshot: PipelineGraphSnapshotSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  committedAt: z.iso.datetime().nullable(),
});
export type AgentChangeSet = z.infer<typeof AgentChangeSetSchema>;

export const AgentActionStatusSchema = z.enum([
  "started",
  "succeeded",
  "failed",
  "approval_required",
  "replayed",
]);
export type AgentActionStatus = z.infer<typeof AgentActionStatusSchema>;

export const AgentActionSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  changeSetId: z.string().min(1).nullable(),
  sequence: z.number().int().positive(),
  toolName: z.string().min(1),
  risk: AgentControlRiskSchema,
  status: AgentActionStatusSchema,
  target: AgentResourceRefSchema.nullable(),
  redactedInput: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  forwardAction: PipelineActionSchema.nullable(),
  inverseActions: z.array(PipelineActionSchema).nullable(),
  idempotencyKey: z.string().min(1).nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AgentApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "consumed",
]);
export type AgentApprovalStatus = z.infer<typeof AgentApprovalStatusSchema>;

export const AgentApprovalSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().min(1).nullable(),
  actionId: z.string().min(1),
  toolName: z.string().min(1),
  callId: z.string().min(1),
  argumentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  target: AgentResourceRefSchema.nullable(),
  resourceVersion: z.number().int().positive().nullable(),
  status: AgentApprovalStatusSchema,
  expiresAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().nullable(),
  consumedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AgentApproval = z.infer<typeof AgentApprovalSchema>;

export const AgentControlRetrySchema = z.object({
  retryable: z.boolean(),
  code: z.string().min(1),
  message: z.string().min(1).max(1000),
  field: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  portId: z.string().min(1).optional(),
});
export type AgentControlRetry = z.infer<typeof AgentControlRetrySchema>;

export const AgentControlToolResultSchema = z.object({
  actionId: z.string().min(1),
  status: AgentActionStatusSchema,
  resources: z.array(AgentResourceRefSchema).max(20).default([]),
  summary: z.string().min(1).max(1000),
  warnings: z.array(z.string().min(1).max(500)).max(10).default([]),
  retry: AgentControlRetrySchema.optional(),
  approvalRequestId: z.string().min(1).optional(),
  artifactRef: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type AgentControlToolResult = z.infer<typeof AgentControlToolResultSchema>;

export const AgentControlRuntimeCapabilitySchema = z.object({
  runtimeConfigId: z.string().min(1),
  runtime: AgentRuntimeSchema,
  name: z.string().min(1),
  supported: z.boolean(),
  reason: z.string().min(1),
  controlModel: z.string().min(1).nullable().default(null),
  controlReasoningEffort: z.string().min(1).nullable().default(null),
});
export type AgentControlRuntimeCapability = z.infer<typeof AgentControlRuntimeCapabilitySchema>;

export const AgentControlCapabilitiesSchema = z.object({
  enabled: z.boolean(),
  toolContractVersion: z.literal(1),
  toolCount: z.number().int().positive(),
  runtimes: z.array(AgentControlRuntimeCapabilitySchema),
});
export type AgentControlCapabilities = z.infer<typeof AgentControlCapabilitiesSchema>;
