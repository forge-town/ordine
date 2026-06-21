import { z } from "zod/v4";
import { PipelineActionDiagnosticSchema } from "./PipelineActionDiagnosticSchema";
import { PipelineActionProposalSchema } from "./PipelineActionProposalSchema";

/**
 * Service-level response of pipelines.proposeActions.
 *
 * - `reply` is the agent's conversational answer (user's language).
 * - `clarifyOptions` are short, verbatim-sendable answers the user can pick
 *   when the agent needs clarification before drafting a proposal.
 * - `proposal` is null when the agent only replied / asked for clarification.
 */
export const ProposeActionsErrorCodeSchema = z.enum([
  "INVALID_SNAPSHOT",
  "RUNTIME_NOT_FOUND",
  "AGENT_FAILED",
  "BAD_AGENT_OUTPUT",
]);
export type ProposeActionsErrorCode = z.infer<typeof ProposeActionsErrorCodeSchema>;

/** Operation drafted by the agent because no existing one matched (PRD §7.3). */
export const ProposePendingOperationSchema = z.object({
  acceptedObjectTypes: z.array(z.string()),
  config: z.record(z.string(), z.unknown()),
  description: z.string(),
  id: z.string(),
  name: z.string(),
});
export type ProposePendingOperation = z.infer<typeof ProposePendingOperationSchema>;

export const ArtifactAnalysisSchema = z.object({
  matchedComponentIds: z.array(z.string()),
  steps: z.array(z.string()),
  structure: z.string(),
});
export type ArtifactAnalysis = z.infer<typeof ArtifactAnalysisSchema>;

export const ProposeActionsResponseSchema = z.object({
  artifactAnalysis: ArtifactAnalysisSchema.optional(),
  pipelineName: z.string().optional(),
  clarifyOptions: z.array(z.string()).max(4).optional(),
  pendingOperations: z.array(ProposePendingOperationSchema).optional(),
  diagnostics: z.array(PipelineActionDiagnosticSchema),
  error: z
    .object({
      code: ProposeActionsErrorCodeSchema,
      detail: z.string().optional(),
    })
    .optional(),
  proposal: PipelineActionProposalSchema.nullable(),
  reply: z.string().optional(),
});
export type ProposeActionsResponse = z.infer<typeof ProposeActionsResponseSchema>;
