import { z } from "zod/v4";
import { NodeTypeSchema } from "../NodeTypeSchema";
import { NODE_CONNECTION_RULES } from "./NodeConnectionRulesSchema";

export const ConnectionRuleSchema = z
  .object({
    sourceType: NodeTypeSchema,
    targetType: NodeTypeSchema,
  })
  .refine(({ sourceType, targetType }) => NODE_CONNECTION_RULES[sourceType]?.includes(targetType), {
    message: "此节点类型间不允许连接",
  });
export type ConnectionRule = z.infer<typeof ConnectionRuleSchema>;
