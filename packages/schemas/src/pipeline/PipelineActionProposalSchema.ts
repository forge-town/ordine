import { z } from "zod/v4";
import { PipelineAgentPlanReadinessSchema } from "../pipeline-agent/PipelineGenerationPlanSchema";
import { PipelineActionSchema } from "./PipelineActionSchema";

export const PipelineActionProposalSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(PipelineActionSchema).min(1),
  openQuestions: z.array(z.string()).optional(),
  readiness: PipelineAgentPlanReadinessSchema.optional(),
});
export type PipelineActionProposal = z.infer<typeof PipelineActionProposalSchema>;
