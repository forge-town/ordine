import { z } from "zod/v4";

export const PipelineAgentPlanReadinessSchema = z.enum([
  "needs_user_answer",
  "ready_for_generation",
]);
export type PipelineAgentPlanReadiness = z.infer<typeof PipelineAgentPlanReadinessSchema>;

export const PipelineGenerationPlanSchema = z.object({
  mode: z.literal("generate"),
  purpose: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  majorOperations: z.array(z.string()).default([]),
  executionFlow: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  readiness: PipelineAgentPlanReadinessSchema,
});
export type PipelineGenerationPlan = z.infer<typeof PipelineGenerationPlanSchema>;
