import { z } from "zod/v4";
import { CanvasEditPlanSchema } from "./CanvasEditPlanSchema";
import { PipelineGenerationPlanSchema } from "./PipelineGenerationPlanSchema";

export const PipelineAgentProposalSchema = z.discriminatedUnion("mode", [
  PipelineGenerationPlanSchema,
  CanvasEditPlanSchema,
]);
export type PipelineAgentProposal = z.infer<typeof PipelineAgentProposalSchema>;

export const PipelineAgentProposalStatusSchema = z.enum([
  "proposal_ready",
  "approved",
  "superseded",
]);
export type PipelineAgentProposalStatus = z.infer<typeof PipelineAgentProposalStatusSchema>;

export const PipelineAgentStoredProposalSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  mode: z.enum(["generate", "edit"]),
  status: PipelineAgentProposalStatusSchema,
  proposal: PipelineAgentProposalSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  approvedAt: z.date().nullable(),
});
export type PipelineAgentStoredProposal = z.infer<typeof PipelineAgentStoredProposalSchema>;
