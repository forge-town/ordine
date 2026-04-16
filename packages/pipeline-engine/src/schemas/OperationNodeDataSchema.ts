import { z } from "zod/v4";
import { NodeRunStatusSchema } from "./NodeRunStatusSchema.js";

export const OperationNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("operation"),
  operationId: z.string(),
  operationName: z.string(),
  status: NodeRunStatusSchema,
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  notes: z.string().optional(),
  llmProvider: z.string().optional(),
  llmModel: z.string().optional(),
  bestPracticeId: z.string().optional(),
  bestPracticeName: z.string().optional(),
  loopEnabled: z.boolean().optional(),
  maxLoopCount: z.number().int().min(1).max(20).optional(),
  loopConditionPrompt: z.string().optional(),
});
export type OperationNodeData = z.infer<typeof OperationNodeDataSchema>;
