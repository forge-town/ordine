import { z } from "zod/v4";
import { PipelineActionSchema } from "./PipelineActionSchema";

export const PipelineActionProposalSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(PipelineActionSchema).min(1),
});
export type PipelineActionProposal = z.infer<typeof PipelineActionProposalSchema>;
