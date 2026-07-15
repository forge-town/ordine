import { z } from "zod/v4";
import { DecisionSelectModeSchema } from "./DecisionSelectModeSchema";

/**
 * Human decision node data. Candidates come from the incoming edges (one candidate
 * artifact per edge); the user picks per selectMode (single/multi), and the chosen
 * candidates become this node's output flowing downstream.
 */
export const DecisionNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("decision"),
  selectMode: DecisionSelectModeSchema,
  instruction: z.string().optional(),
  description: z.string().optional(),
});
export type DecisionNodeData = z.infer<typeof DecisionNodeDataSchema>;
