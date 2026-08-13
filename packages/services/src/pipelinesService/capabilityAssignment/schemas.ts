import {
  AssignedOperationExecutorConfigSchema,
  type AgentRuntime,
  type CapabilityCatalogEntry,
} from "@repo/schemas";
import { z } from "zod/v4";

const ReferenceSchema = z.string().trim().min(1);

export const PerStepCapabilityAssignmentSchema = z
  .object({
    operationId: ReferenceSchema,
    executor: AssignedOperationExecutorConfigSchema,
  })
  .strict();
export type PerStepCapabilityAssignment = z.infer<typeof PerStepCapabilityAssignmentSchema>;

export const CapabilityAssignmentOutputSchema = z
  .object({
    assignments: z.array(PerStepCapabilityAssignmentSchema).min(1).max(50),
  })
  .strict();

export type CapabilityAssignmentStep = {
  operationId: string;
  name: string;
  description: string;
};

export type CapabilityAssignmentAgentTarget = {
  agent: AgentRuntime;
  models: string[];
};

export type CapabilityAssignmentContext = {
  steps: CapabilityAssignmentStep[];
  agentTargets: CapabilityAssignmentAgentTarget[];
  capabilityCatalog: CapabilityCatalogEntry[];
};

export type CapabilityAssignmentParseResult =
  | { ok: true; assignments: PerStepCapabilityAssignment[]; diagnostics: [] }
  | { ok: false; assignments: []; diagnostics: string[] };
