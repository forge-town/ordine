import { z } from "zod/v4";
import { NodeRunStatusSchema } from "./NodeRunStatusSchema.js";

export const ConditionNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("condition"),
  expression: z.string(),
  expectedResult: z.string(),
  status: NodeRunStatusSchema,
  notes: z.string().optional(),
});
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema>;
