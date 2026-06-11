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
export const ProposeActionsResponseSchema = z.object({
  clarifyOptions: z.array(z.string()).max(4).optional(),
  diagnostics: z.array(PipelineActionDiagnosticSchema),
  proposal: PipelineActionProposalSchema.nullable(),
  reply: z.string().optional(),
});
export type ProposeActionsResponse = z.infer<typeof ProposeActionsResponseSchema>;
