import { z } from "zod/v4";
import { DecisionSelectModeSchema } from "./DecisionSelectModeSchema";

/**
 * 人类决策节点数据。候选来自上游边（每条入边一个候选工件），
 * 用户按 selectMode 单选/多选后，选中候选成为本节点产物流向下游。
 */
export const DecisionNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("decision"),
  selectMode: DecisionSelectModeSchema,
  instruction: z.string().optional(),
  description: z.string().optional(),
});
export type DecisionNodeData = z.infer<typeof DecisionNodeDataSchema>;
