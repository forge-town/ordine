import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { PipelineActionSchema } from "../pipeline/PipelineActionSchema";
import {
  AgentControlRetrySchema,
  AgentControlRiskSchema,
  AgentControlToolResultSchema,
  AgentResourceRefSchema,
} from "./AgentControlSchema";

const AgentControlEventBaseSchema = z.object({
  runtime: AgentRuntimeSchema,
  timestamp: z.iso.datetime(),
  sequence: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const AgentActionStartedEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("action_started"),
  actionId: z.string().min(1),
  toolName: z.string().min(1),
  risk: AgentControlRiskSchema,
  target: AgentResourceRefSchema.nullable().optional(),
  summary: z.string().min(1).max(1000),
});

const AgentActionSucceededEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("action_succeeded"),
  actionId: z.string().min(1),
  result: AgentControlToolResultSchema,
});

const AgentActionFailedEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("action_failed"),
  actionId: z.string().min(1),
  toolName: z.string().min(1),
  error: AgentControlRetrySchema,
});

const AgentApprovalRequiredEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("approval_required"),
  actionId: z.string().min(1),
  approvalRequestId: z.string().min(1),
  toolName: z.string().min(1),
  target: AgentResourceRefSchema.nullable(),
  expiresAt: z.iso.datetime(),
  summary: z.string().min(1).max(1000),
});

const AgentDraftAppliedEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("draft_applied"),
  actionId: z.string().min(1),
  changeSetId: z.string().min(1),
  pipelineId: z.string().min(1),
  action: PipelineActionSchema,
});

const AgentChangeSetReadyEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("change_set_ready"),
  changeSetId: z.string().min(1),
  target: AgentResourceRefSchema,
  baseVersion: z.number().int().positive(),
  actionCount: z.number().int().nonnegative(),
  summary: z.string().min(1).max(1000),
});

const AgentChangeSetCommittedEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("change_set_committed"),
  changeSetId: z.string().min(1),
  target: AgentResourceRefSchema,
  previousVersion: z.number().int().positive(),
  newVersion: z.number().int().positive(),
});

const AgentChangeSetRolledBackEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("change_set_rolled_back"),
  changeSetId: z.string().min(1),
  target: AgentResourceRefSchema,
  reason: z.enum(["rejected", "cancelled", "failed", "reverted"]),
});

const AgentNavigationRequestedEventSchema = AgentControlEventBaseSchema.extend({
  type: z.literal("navigation_requested"),
  pathname: z.string().min(1).max(2048),
  resource: AgentResourceRefSchema.optional(),
  focusId: z.string().min(1).optional(),
});

export const AgentControlEventSchema = z.discriminatedUnion("type", [
  AgentActionStartedEventSchema,
  AgentActionSucceededEventSchema,
  AgentActionFailedEventSchema,
  AgentApprovalRequiredEventSchema,
  AgentDraftAppliedEventSchema,
  AgentChangeSetReadyEventSchema,
  AgentChangeSetCommittedEventSchema,
  AgentChangeSetRolledBackEventSchema,
  AgentNavigationRequestedEventSchema,
]);
export type AgentControlEvent = z.infer<typeof AgentControlEventSchema>;
