import { z } from "zod/v4";
import { BuiltinNodeTypeSchema, type BuiltinNodeType } from "@repo/schemas";

const nodeTypeArray = z.array(BuiltinNodeTypeSchema);

export const NodeConnectionRulesSchema = z.object({
  file: nodeTypeArray,
  compound: nodeTypeArray,
  decision: nodeTypeArray,
  folder: nodeTypeArray,
  "github-project": nodeTypeArray,
  operation: nodeTypeArray,
  prompt: nodeTypeArray,
  "output-project-path": nodeTypeArray,
  "output-local-path": nodeTypeArray,
});
export type NodeConnectionRules = z.infer<typeof NodeConnectionRulesSchema>;

export const NODE_CONNECTION_RULES: NodeConnectionRules = NodeConnectionRulesSchema.parse({
  file: ["operation", "compound", "decision"],
  compound: ["operation", "compound", "decision", "output-project-path", "output-local-path"],
  decision: ["operation", "compound", "output-project-path", "output-local-path"],
  folder: ["operation", "compound", "decision"],
  "github-project": ["operation", "compound", "decision"],
  operation: ["operation", "compound", "decision", "output-project-path", "output-local-path"],
  prompt: ["operation", "compound", "decision"],
  "output-project-path": [],
  "output-local-path": [],
} satisfies Record<BuiltinNodeType, BuiltinNodeType[]>);

export const isConnectionAllowed = (
  sourceType: BuiltinNodeType,
  targetType: BuiltinNodeType,
): boolean => NODE_CONNECTION_RULES[sourceType]?.includes(targetType) ?? false;
