import { z } from "zod/v4";
import { isValidCronExpression } from "@repo/utils/cron";

export const PipelineAgentPlanReadinessSchema = z.enum([
  "needs_user_answer",
  "ready_for_generation",
]);
export type PipelineAgentPlanReadiness = z.infer<typeof PipelineAgentPlanReadinessSchema>;

export const PipelineGenerationScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  cronExpression: z
    .string()
    .refine(isValidCronExpression, "cronExpression is not a valid 5-field cron expression"),
  enabled: z.boolean().default(true),
});
export type PipelineGenerationSchedule = z.infer<typeof PipelineGenerationScheduleSchema>;

export const PipelineGenerationPlanSchema = z.object({
  mode: z.literal("generate"),
  assistantReply: z.string().min(1).optional(),
  purpose: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  majorOperations: z.array(z.string()).default([]),
  executionFlow: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  schedule: PipelineGenerationScheduleSchema.nullable().optional(),
  readiness: PipelineAgentPlanReadinessSchema,
});
export type PipelineGenerationPlan = z.infer<typeof PipelineGenerationPlanSchema>;
