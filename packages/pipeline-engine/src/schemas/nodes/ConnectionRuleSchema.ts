import { z } from "zod/v4";
import { BuiltinNodeTypeSchema } from "@repo/schemas";
import { NODE_CONNECTION_RULES } from "./NodeConnectionRulesSchema";

export const ConnectionRuleSchema = z
  .object({
    sourceType: BuiltinNodeTypeSchema,
    targetType: BuiltinNodeTypeSchema,
  })
  .refine(({ sourceType, targetType }) => NODE_CONNECTION_RULES[sourceType]?.includes(targetType), {
    message: "此节点类型间不允许连接",
  });
export type ConnectionRule = z.infer<typeof ConnectionRuleSchema>;
