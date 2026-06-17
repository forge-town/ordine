import { z } from "zod/v4";

export const DECISION_NODE_TYPE_ENUM = {
  DECISION: "decision",
} as const;
export const DecisionNodeTypeSchema = z.enum(DECISION_NODE_TYPE_ENUM);
export type DecisionNodeType = z.infer<typeof DecisionNodeTypeSchema>;
