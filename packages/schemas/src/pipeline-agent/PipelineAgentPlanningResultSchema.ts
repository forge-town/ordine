import { z } from "zod/v4";
import { PipelineAgentProposalSchema } from "./PipelineAgentProposalSchema";

export const PipelineAgentPlanningResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    question: z.string().min(1),
  }),
  z.object({
    type: z.literal("proposal"),
    proposal: PipelineAgentProposalSchema,
  }),
]);
export type PipelineAgentPlanningResult = z.infer<typeof PipelineAgentPlanningResultSchema>;
